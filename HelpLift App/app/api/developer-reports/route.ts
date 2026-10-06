import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { clientIp, isRateLimited } from "@/lib/rate-limit"
import { isValidEmail } from "@/lib/password"
import { DEV_REPORT_BUCKET, DEV_REPORT_MAX_FILE_BYTES, DEV_REPORT_MAX_FILES, detectFileType } from "@/lib/developer-report-files"

// Anonymous developer reports from the public /developers page (see
// 20261006000300_developer_reports.sql): bugs, improvement ideas and security
// issues, with optional proof files.
//
// Anonymous on purpose: no account is linked even if the sender is signed in;
// a contact email is kept only if they choose to give one.
//
// Proof files were already uploaded straight to the private bucket (via
// /api/developer-reports/uploads - Vercel caps request bodies at 4.5 MB, so
// they can't come through here). This checks each one really is in this
// report's folder, within the size limit, and - by its first bytes - an
// image, PDF or video, before saving the report. Spam protection: a hidden
// honeypot field and a per-IP rate limit.

const TYPES = ["bug", "improvement", "security", "other"] as const
const SEVERITIES = ["low", "medium", "high", "critical"] as const
const RATE_LIMIT = 5
const RATE_WINDOW_MS = 60 * 60 * 1000 // per hour
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const text = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "")

export async function POST(request: Request) {
  try {
    if (isRateLimited(`dev-report:${clientIp(request)}`, RATE_LIMIT, RATE_WINDOW_MS)) {
      return NextResponse.json({ message: "You've sent several reports in a short time - please try again in an hour." }, { status: 429 })
    }

    const body = await request.json().catch(() => ({}))
    // Honeypot: a hidden field real people never fill in.
    if (text(body.website, 200)) return NextResponse.json({ success: true, message: "Thank you for your report!" })

    const reportType = text(body.report_type, 20)
    const title = text(body.title, 150)
    const description = text(body.description, 5000)
    const steps = text(body.steps_to_reproduce, 3000)
    const pageUrl = text(body.page_url, 300)
    const severity = text(body.severity, 20)
    const contactEmail = text(body.contact_email, 200)

    if (!(TYPES as readonly string[]).includes(reportType)) return NextResponse.json({ message: "Choose what kind of report this is." }, { status: 400 })
    if (title.length < 5) return NextResponse.json({ message: "Give your report a short title (at least 5 characters)." }, { status: 400 })
    if (description.length < 20) return NextResponse.json({ message: "Please describe it in a bit more detail (at least 20 characters)." }, { status: 400 })
    if (severity && !(SEVERITIES as readonly string[]).includes(severity)) return NextResponse.json({ message: "Choose a valid severity." }, { status: 400 })
    if (contactEmail && !isValidEmail(contactEmail)) return NextResponse.json({ message: "That contact email doesn't look right - or leave it empty to stay anonymous." }, { status: 400 })

    const admin = createAdminClient()
    const storage = admin.storage.from(DEV_REPORT_BUCKET)
    const requested: { path?: unknown; name?: unknown }[] = Array.isArray(body.attachments) ? body.attachments : []
    const reportId = typeof body.report_id === "string" && UUID.test(body.report_id) ? body.report_id : crypto.randomUUID()
    if (requested.length > DEV_REPORT_MAX_FILES) return NextResponse.json({ message: `Attach up to ${DEV_REPORT_MAX_FILES} files.` }, { status: 400 })

    // Check every proof file before saving anything.
    const attachments: { path: string; name: string; type: string; size: number }[] = []
    if (requested.length > 0) {
      const { data: listed } = await storage.list(reportId, { limit: 100 })
      const rejectAll = async (message: string) => {
        if (listed?.length) await storage.remove(listed.map(item => `${reportId}/${item.name}`))
        return NextResponse.json({ message }, { status: 400 })
      }
      for (const item of requested) {
        const path = typeof item.path === "string" ? item.path : ""
        const fileName = path.startsWith(`${reportId}/`) ? path.slice(reportId.length + 1) : ""
        const stored = fileName && !fileName.includes("/") ? listed?.find(entry => entry.name === fileName) : undefined
        if (!stored) return rejectAll("One of your files didn't finish uploading. Please try again.")
        const size = Number((stored.metadata as any)?.size || 0)
        if (size <= 0 || size > DEV_REPORT_MAX_FILE_BYTES) return rejectAll(`"${text(item.name, 120) || fileName}" must be smaller than 25 MB.`)
        // Read just the first bytes to confirm what the file really is.
        const { data: signed } = await storage.createSignedUrl(path, 60)
        const head = signed ? await fetch(signed.signedUrl, { headers: { Range: "bytes=0-15" } }).then(res => res.arrayBuffer()).catch(() => null) : null
        const type = head ? detectFileType(new Uint8Array(head)) : null
        if (!type) return rejectAll(`"${text(item.name, 120) || fileName}" isn't a supported file. Use an image, PDF, MP4 or WebM.`)
        attachments.push({ path, name: text(item.name, 120) || fileName, type, size })
      }
    }

    const { error } = await admin.from("developer_reports").insert({
      id: reportId,
      report_type: reportType,
      title,
      description,
      steps_to_reproduce: steps || null,
      page_url: pageUrl || null,
      severity: severity || null,
      contact_email: contactEmail || null,
      user_agent: request.headers.get("user-agent")?.slice(0, 400) || null,
      attachments,
    })
    if (error) {
      console.error("Developer report save error:", error.message)
      return NextResponse.json({ message: "Couldn't save your report right now. Please try again shortly." }, { status: 503 })
    }

    // Let the administrators know (best-effort - the report is already saved).
    try {
      const { data: admins } = await admin.from("profiles").select("id").eq("role", "admin").eq("suspended", false)
      const label = { bug: "Bug report", improvement: "Improvement idea", security: "Security report", other: "Developer report" }[reportType as (typeof TYPES)[number]]
      const notifications = (admins || []).map(row => ({
        recipient_id: row.id,
        sender_name: "Developer (anonymous)",
        type: "developer_report",
        title: `${label}: ${title}`,
        message: `${label}${severity ? ` (${severity} severity)` : ""} submitted on the Developers page.\n\n${description.slice(0, 400)}${description.length > 400 ? "..." : ""}\n\nOpen the Dev reports tab to review it.`,
      }))
      if (notifications.length > 0) await admin.from("notifications").insert(notifications)
    } catch (notifyError) {
      console.warn("Developer report notification warning:", notifyError)
    }

    return NextResponse.json({ success: true, message: "Thank you! Your report has been sent to the HelpLift team." }, { status: 201 })
  } catch (error) {
    console.error("Developer report error:", error)
    return NextResponse.json({ message: "Couldn't send your report right now. Please try again shortly." }, { status: 503 })
  }
}
