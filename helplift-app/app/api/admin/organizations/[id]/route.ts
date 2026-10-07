import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { logUserAction } from "@/lib/activity-log"

const ALLOWED_STATUSES = new Set(["pending", "approved", "rejected", "more_info_requested"])
// Banking details are deliberately NOT here: payouts go to them, so only the
// organization's own owner may change them.
const ALLOWED_FIELDS = new Set([
  "name",
  "type",
  "registration_number",
  "contact_name",
  "contact_role",
  "mission",
  "contact_email",
  "phone",
  "address",
  "city",
  "province",
  "verification_status",
  "verification_notes"
])

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ message: "Authentication required." }, { status: 401 })

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
    if (profile?.role !== "admin") return NextResponse.json({ message: "Administrator access required." }, { status: 403 })

    const { id } = await context.params
    const raw: Record<string, any> = await request.json()

    const update: Record<string, any> = {}
    for (const key of Object.keys(raw)) {
      if (ALLOWED_FIELDS.has(key)) {
        const value = raw[key]
        if (typeof value === "string" && key !== "verification_status") {
          update[key] = value.trim() || null
        } else {
          update[key] = value
        }
      }
    }

    if (update.verification_status !== undefined && !ALLOWED_STATUSES.has(update.verification_status)) {
      return NextResponse.json({ message: "Invalid verification status." }, { status: 400 })
    }
    if (update.verification_status === "more_info_requested" && !update.verification_notes) {
      return NextResponse.json({ message: "Explain what additional information is needed." }, { status: 400 })
    }

    if (update.contact_email !== undefined && update.contact_email !== null) {
      const basicEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!basicEmail.test(update.contact_email)) {
        return NextResponse.json({ message: "Invalid email format for contact_email." }, { status: 400 })
      }
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ message: "No updatable organization fields provided." }, { status: 400 })
    }

    const { data: organizationOwner } = await supabase.from("organizations").select("profile_id, name").eq("id", id).single()
    const { data: organization, error } = await supabase
      .from("organizations")
      .update(update)
      .eq("id", id)
      .select("id, name, type, contact_email, verification_status, verification_notes, phone, address, city, province")
      .single()

    if (error) return NextResponse.json({ message: error.message }, { status: 400 })

    if (organizationOwner && update.verification_status !== undefined) {
      try {
        const status = update.verification_status
        const verdictText = status === "more_info_requested"
          ? "asked to provide additional information"
          : `marked ${status}`
        await supabase.from("notifications").insert({
          recipient_id: organizationOwner.profile_id,
          sender_id: user.id,
          sender_name: "HelpLift Notifications",
          type: "organization_verification",
          title: status === "more_info_requested" ? "Additional information requested" : `Organization ${status}`,
          message: `${organizationOwner.name} was ${verdictText} by an administrator.${update.verification_notes ? ` Note: ${update.verification_notes}` : ""}`,
        })
      } catch (e) {
        console.error("Organization verification notification insert failed:", e)
      }
    }

    const verdict = update.verification_status !== undefined ? ` - marked ${update.verification_status}` : ""
    await logUserAction(supabase, "Edited an organization", `${organization?.name || organizationOwner?.name || "Organization"}${verdict}`)

    return NextResponse.json({ organization })
  } catch (error) {
    console.error("Organization moderation error:", error)
    return NextResponse.json({ message: "Organization update is unavailable." }, { status: 503 })
  }
}
