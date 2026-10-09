import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

// Admins can step in on a delivery that's still active: cancel one that's
// stuck or abandoned, or mark one completed (e.g. confirmed outside the
// platform). The giver and the organization are both notified, with the
// admin's reason if one was given.
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ message: "Authentication required." }, { status: 401 })
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
    if (profile?.role !== "admin") return NextResponse.json({ message: "Administrator access required." }, { status: 403 })

    const { id } = await context.params
    const body = await request.json().catch(() => ({}))
    const status = body.status
    const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 1000) : ""
    if (status !== "cancelled" && status !== "completed") {
      return NextResponse.json({ message: "Status must be cancelled or completed." }, { status: 400 })
    }

    const db = createAdminClient()
    const { data: existing } = await db
      .from("fulfillments")
      .select("id, status, givers(profile_id), organizations(profile_id, name), support_interests(needs(title)), gift_offerings(title)")
      .eq("id", id)
      .maybeSingle()
    if (!existing) return NextResponse.json({ message: "Fulfillment not found." }, { status: 404 })
    if (existing.status !== "pending" && existing.status !== "in_progress") {
      return NextResponse.json({ message: "Only an active delivery (pending or in progress) can be changed." }, { status: 400 })
    }

    const { error } = await db
      .from("fulfillments")
      .update({ status, completed_at: status === "completed" ? new Date().toISOString() : null })
      .eq("id", id)
    if (error) return NextResponse.json({ message: error.message }, { status: 400 })

    try {
      const one = (value: any) => (Array.isArray(value) ? value[0] : value)
      const interest = one((existing as any).support_interests)
      const title = one(interest?.needs)?.title || one((existing as any).gift_offerings)?.title || "a delivery"
      const org = one((existing as any).organizations)
      const giver = one((existing as any).givers)
      const verdict = status === "cancelled" ? "cancelled" : "marked completed"
      const reasonText = reason ? ` Reason: ${reason}` : ""
      const recipients = [org?.profile_id, giver?.profile_id].filter(Boolean) as string[]
      if (recipients.length > 0) {
        await db.from("notifications").insert(recipients.map(recipient_id => ({
          recipient_id,
          sender_id: user.id,
          sender_name: "HelpLift Notifications",
          type: "fulfillment_update",
          title: `Delivery ${verdict}`,
          message: `The delivery for "${title}"${org?.name ? ` (${org.name})` : ""} was ${verdict} by a HelpLift administrator.${reasonText}`,
        })))
      }
    } catch (notifyError) {
      console.warn("Fulfillment update notification warning:", notifyError)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Admin fulfillment update error:", error)
    return NextResponse.json({ message: "Fulfillment update is unavailable." }, { status: 503 })
  }
}

// Housekeeping only - a fulfillment still 'pending' or 'in_progress' is a
// giver actively delivering on a commitment; deleting that out from under
// them isn't an admin's call. Only once it's actually done (completed or
// cancelled) is this a historical record an admin can clear out.
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ message: "Authentication required." }, { status: 401 })
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
    if (profile?.role !== "admin") return NextResponse.json({ message: "Administrator access required." }, { status: 403 })

    const { id } = await context.params
    const { data: existing } = await supabase.from("fulfillments").select("id, status").eq("id", id).single()
    if (!existing) return NextResponse.json({ message: "Fulfillment not found." }, { status: 404 })
    if (existing.status !== "completed" && existing.status !== "cancelled") {
      return NextResponse.json({ message: "Only a completed or cancelled fulfillment can be deleted this way." }, { status: 400 })
    }

    const { error } = await supabase.from("fulfillments").delete().eq("id", id)
    if (error) return NextResponse.json({ message: error.message }, { status: 400 })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Admin fulfillment delete error:", error)
    return NextResponse.json({ message: "Fulfillment deletion is unavailable." }, { status: 503 })
  }
}
