import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

const MAX_MESSAGE_LENGTH = 2000
const MAX_PER_DAY = 5

// Platform feedback from givers and organizations: a 1-5 rating and an optional
// note on how HelpLift could improve. Saved for the admin's Feedback tab and sent
// to every administrator as a notification (the notification-email webhook then
// emails it, like any other notification).
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ message: "Sign in to send feedback." }, { status: 401 })

    const { data: profile } = await supabase.from("profiles").select("full_name, email, role").eq("id", user.id).single()
    if (!profile || !["giver", "organization"].includes(profile.role)) {
      return NextResponse.json({ message: "Feedback is for givers and organizations." }, { status: 403 })
    }

    // Organization viewers are read-only and can't contact the administrators.
    let senderName = profile.full_name || profile.email || "A HelpLift user"
    if (profile.role === "organization") {
      const { data: membership } = await supabase
        .from("organization_members")
        .select("role, organizations(name)")
        .eq("profile_id", user.id)
        .maybeSingle()
      if (membership?.role === "viewer") {
        return NextResponse.json({ message: "Viewers can't contact the administrators. Ask an owner or manager to send feedback." }, { status: 403 })
      }
      const orgField = (membership as any)?.organizations
      const orgName = Array.isArray(orgField) ? orgField[0]?.name : orgField?.name
      if (orgName) senderName = `${orgName} (${profile.full_name || "team member"})`
    }

    const body = await request.json().catch(() => ({}))
    const rating = Number(body.rating)
    const note = typeof body.message === "string" ? body.message.trim() : ""
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return NextResponse.json({ message: "Choose a rating from 1 to 5 stars." }, { status: 400 })
    }
    if (note.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json({ message: `Feedback can be up to ${MAX_MESSAGE_LENGTH} characters.` }, { status: 400 })
    }

    const admin = createAdminClient()

    // Feedback can be sent any time, but not in floods.
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { count } = await admin
      .from("platform_feedback")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", user.id)
      .gte("created_at", since)
    if ((count || 0) >= MAX_PER_DAY) {
      return NextResponse.json({ message: "You've sent a lot of feedback today. Thank you! Please try again tomorrow." }, { status: 429 })
    }

    const { error: insertError } = await admin.from("platform_feedback").insert({
      profile_id: user.id,
      sender_role: profile.role,
      sender_name: senderName,
      sender_email: profile.email,
      rating,
      message: note || null,
    })
    if (insertError) return NextResponse.json({ message: insertError.message }, { status: 400 })

    // Tell every administrator. A failure here doesn't lose the feedback: it is
    // already saved and shows in the Feedback tab.
    try {
      const { data: admins } = await admin.from("profiles").select("id").eq("role", "admin").eq("suspended", false)
      const stars = "★".repeat(rating) + "☆".repeat(5 - rating)
      const roleLabel = profile.role === "organization" ? "organization" : "giver"
      const notifications = (admins || []).map(row => ({
        recipient_id: row.id,
        sender_id: user.id,
        sender_name: senderName,
        sender_role: profile.role,
        type: "platform_feedback",
        title: `Platform feedback: ${rating}/5 from ${senderName}`,
        message: `${stars}  ${rating}/5 from ${senderName} (${roleLabel}, ${profile.email || "no email"}).\n\n${note || "(No comment.)"}`,
      }))
      if (notifications.length > 0) await admin.from("notifications").insert(notifications)
    } catch (notifyError) {
      console.warn("Feedback notification warning:", notifyError)
    }

    return NextResponse.json({ success: true, message: "Thank you! Your feedback has been sent to the HelpLift team." }, { status: 201 })
  } catch (error) {
    console.error("Feedback error:", error)
    return NextResponse.json({ message: "Could not send your feedback right now." }, { status: 503 })
  }
}
