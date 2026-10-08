import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { clientIp, isRateLimited } from "@/lib/rate-limit"
import { isValidEmail } from "@/lib/password"
import { DEV_REPORT_MAX_FILE_BYTES, DEV_REPORT_MAX_FILES, detectFileType } from "@/lib/developer-report-files"
import { TIP_OFF_BUCKET, TIP_OFF_CATEGORIES, tipOffCategoryLabel } from "@/lib/tip-offs"

// Anonymous tip-offs from the homepage (see 20261008000200_tip_offs.sql):
// reports of fraud, scams, abuse or other illegal or suspicious activity by a
// registered organization, for the HelpLift team to investigate.
//
// Anonymous on purpose: no account, IP address or device is saved, even if
// the sender is signed in (the IP is only used, in memory, for the rate
// limit). A contact email is kept only if they choose to give one.
//
// Evidence files were already uploaded straight to the private bucket (via
// /api/tip-offs/uploads). This checks each one really is in this tip-off's
// folder, within the size limit, and - by its first bytes - an image, PDF or
// video, before saving. Spam protection: a hidden honeypot field and a per-IP
// rate limit. Every active administrator gets an in-app notification.

const RATE_LIMIT = 5
const RATE_WINDOW_MS = 60 * 60 * 1000 // per hour
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const CATEGORY_VALUES: string[] = TIP_OFF_CATEGORIES.map(category => category.value)

const text = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "")

export async function POST(request: Request) {
  try {
    if (isRateLimited(`tip-off:${clientIp(request)}`, RATE_LIMIT, RATE_WINDOW_MS)) {
      return NextResponse.json({ message: "You've sent several tip-offs in a short time - please try again in an hour." }, { status: 429 })
    }

    const body = await request.json().catch(() => ({}))
    const thanks = "Thank you. Your tip-off has been sent to the HelpLift team, and we will look into it."
    // Honeypot: a hidden field real people never fill in.
    if (text(body.website, 200)) return NextResponse.json({ success: true, message: thanks })

    const requestedOrgId = text(body.organization_id, 40)
    let organizationName = text(body.organization_name, 200)
    const category = text(body.category, 40)
    const details = text(body.details, 5000)
    const occurredAt = text(body.occurred_at_text, 200)
    const contactEmail = text(body.contact_email, 200)

    if (!CATEGORY_VALUES.includes(category)) return NextResponse.json({ message: "Choose what the concern is about." }, { status: 400 })
    if (details.length < 30) return NextResponse.json({ message: "Please describe what happened in a bit more detail (at least 30 characters)." }, { status: 400 })
    if (contactEmail && !isValidEmail(contactEmail)) return NextResponse.json({ message: "That contact email doesn't look right - or leave it empty to stay anonymous." }, { status: 400 })

    const admin = createAdminClient()

    // Link the organization when it was picked from the list, using its real name.
    let organizationId: string | null = null
    if (requestedOrgId && UUID.test(requestedOrgId)) {
      const { data: org } = await admin.from("organizations").select("id, name").eq("id", requestedOrgId).maybeSingle()
      if (org) {
        organizationId = org.id
        organizationName = org.name
      }
    }
    if (organizationName.length < 2) return NextResponse.json({ message: "Tell us which organization this is about." }, { status: 400 })

    const storage = admin.storage.from(TIP_OFF_BUCKET)
    const requested: { path?: unknown; name?: unknown }[] = Array.isArray(body.attachments) ? body.attachments : []
    const tipOffId = typeof body.tip_off_id === "string" && UUID.test(body.tip_off_id) ? body.tip_off_id : crypto.randomUUID()
    if (requested.length > DEV_REPORT_MAX_FILES) return NextResponse.json({ message: `Attach up to ${DEV_REPORT_MAX_FILES} files.` }, { status: 400 })

    // Check every evidence file before saving anything.
    const attachments: { path: string; name: string; type: string; size: number }[] = []
    if (requested.length > 0) {
      const { data: listed } = await storage.list(tipOffId, { limit: 100 })
      const rejectAll = async (message: string) => {
        if (listed?.length) await storage.remove(listed.map(item => `${tipOffId}/${item.name}`))
        return NextResponse.json({ message }, { status: 400 })
      }
      for (const item of requested) {
        const path = typeof item.path === "string" ? item.path : ""
        const fileName = path.startsWith(`${tipOffId}/`) ? path.slice(tipOffId.length + 1) : ""
        const stored = fileName && !fileName.includes("/") ? listed?.find(entry => entry.name === fileName) : undefined
        if (!stored) return rejectAll("One of your files didn't finish uploading. Please try again.")
        const size = Number((stored.metadata as any)?.size || 0)
        if (size <= 0 || size > DEV_REPORT_MAX_FILE_BYTES) return rejectAll(`"${text(item.name, 120) || fileName}" must be smaller than 25 MB.`)
        const { data: signed } = await storage.createSignedUrl(path, 60)
        const head = signed ? await fetch(signed.signedUrl, { headers: { Range: "bytes=0-15" } }).then(res => res.arrayBuffer()).catch(() => null) : null
        const type = head ? detectFileType(new Uint8Array(head)) : null
        if (!type) return rejectAll(`"${text(item.name, 120) || fileName}" isn't a supported file. Use an image, PDF, MP4 or WebM.`)
        attachments.push({ path, name: text(item.name, 120) || fileName, type, size })
      }
    }

    const { error } = await admin.from("tip_offs").insert({
      id: tipOffId,
      organization_id: organizationId,
      organization_name: organizationName,
      category,
      details,
      occurred_at_text: occurredAt || null,
      contact_email: contactEmail || null,
      attachments,
    })
    if (error) {
      console.error("Tip-off save error:", error.message)
      return NextResponse.json({ message: "Couldn't send your tip-off right now. Please try again shortly." }, { status: 503 })
    }

    // In-app notification for every administrator (best-effort - the tip-off is already saved).
    try {
      const { data: admins } = await admin.from("profiles").select("id").eq("role", "admin").eq("suspended", false)
      const label = tipOffCategoryLabel(category)
      const notifications = (admins || []).map(row => ({
        recipient_id: row.id,
        sender_name: "Anonymous tip-off",
        type: "tip_off",
        title: `Tip-off: ${organizationName}`,
        message: `${label}.\n\n${details.slice(0, 400)}${details.length > 400 ? "..." : ""}\n\nOpen the Inquiries tab to review and investigate it.`,
      }))
      if (notifications.length > 0) await admin.from("notifications").insert(notifications)
    } catch (notifyError) {
      console.warn("Tip-off notification warning:", notifyError)
    }

    return NextResponse.json({ success: true, message: thanks }, { status: 201 })
  } catch (error) {
    console.error("Tip-off error:", error)
    return NextResponse.json({ message: "Couldn't send your tip-off right now. Please try again shortly." }, { status: 503 })
  }
}
