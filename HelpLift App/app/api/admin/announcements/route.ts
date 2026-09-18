import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

const TARGET_ROLES: Record<string, string[]> = {
  givers: ["giver"],
  organizations: ["organization"],
  both: ["giver", "organization"],
}

// Broadcasts to many recipients at once, unlike send_notification() (the
// RPC behind person-to-person messaging), which is scoped to exactly one
// recipient and carries relationship checks that don't apply here — an
// admin can already message anyone unconditionally. "Admins can create
// notifications" (RLS insert policy) checks is_admin() per row, not per
// statement, so a single bulk insert with many different recipient_ids is
// fine in one call.
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ message: "Authentication required." }, { status: 401 })

    const { data: adminProfile } = await supabase.from("profiles").select("role, full_name").eq("id", user.id).single()
    if (adminProfile?.role !== "admin") return NextResponse.json({ message: "Administrator access required." }, { status: 403 })

    const { target, title, message } = await request.json()
    const roles = TARGET_ROLES[target]
    if (!roles) return NextResponse.json({ message: "Invalid target. Must be one of: givers, organizations, both." }, { status: 400 })

    const trimmedTitle = typeof title === "string" ? title.trim() : ""
    const trimmedMessage = typeof message === "string" ? message.trim() : ""
    if (!trimmedTitle) return NextResponse.json({ message: "Title is required." }, { status: 400 })
    if (!trimmedMessage) return NextResponse.json({ message: "Message is required." }, { status: 400 })
    if (trimmedTitle.length > 200) return NextResponse.json({ message: "Title is too long (200 characters max)." }, { status: 400 })
    if (trimmedMessage.length > 2000) return NextResponse.json({ message: "Message is too long (2000 characters max)." }, { status: 400 })

    const { data: recipients, error: recipientsError } = await supabase.from("profiles").select("id").in("role", roles)
    if (recipientsError) return NextResponse.json({ message: recipientsError.message }, { status: 400 })
    if (!recipients || recipients.length === 0) {
      return NextResponse.json({ message: "No recipients found for this target." }, { status: 400 })
    }

    const rows = recipients.map((r) => ({
      recipient_id: r.id,
      sender_id: user.id,
      sender_name: adminProfile.full_name,
      sender_role: "admin",
      type: "admin_announcement",
      title: trimmedTitle,
      message: trimmedMessage,
    }))

    const { error: insertError } = await supabase.from("notifications").insert(rows)
    if (insertError) return NextResponse.json({ message: insertError.message }, { status: 400 })

    return NextResponse.json({ success: true, recipientCount: rows.length }, { status: 201 })
  } catch (error) {
    console.error("Send announcement error:", error)
    return NextResponse.json({ message: "Unable to send announcement right now." }, { status: 503 })
  }
}
