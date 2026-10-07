import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// First-time moderation of a goods/services listing only (pending ->
// approved/rejected). Financial pledges are moderated via the linked
// donation's review instead (see admin/donations/[id]). Reviewing a *claim*
// on an already-approved listing is a separate concern now that an offering
// can have several claims at once - see admin/gifts/claims/[claimId].
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
    const { status, rejection_reason } = await request.json()
    const cleanRejectionReason = typeof rejection_reason === "string" && rejection_reason.trim() ? rejection_reason.trim() : null

    if (!["approved", "rejected"].includes(status)) {
      return NextResponse.json({ message: "Invalid gift status." }, { status: 400 })
    }

    const { data: current, error: currentError } = await supabase
      .from("gift_offerings")
      .select("id, title, status, giver_id, offering_type")
      .eq("id", id)
      .single()
    if (currentError || !current) return NextResponse.json({ message: "Gift offering not found." }, { status: 404 })
    if (current.status !== "pending") {
      return NextResponse.json({ message: "This listing has already been reviewed." }, { status: 400 })
    }
    if (current.offering_type === "financial" && status === "approved") {
      return NextResponse.json({ message: "A financial pledge is approved automatically once its donation is confirmed - it can only be cancelled here, not manually approved." }, { status: 400 })
    }

    const { data: gift, error } = await supabase
      .from("gift_offerings")
      .update({ status, rejection_reason: status === "rejected" ? cleanRejectionReason : null })
      .eq("id", id)
      .select()
      .single()
    if (error) return NextResponse.json({ message: error.message }, { status: 400 })

    // Cancelling a financial pledge's listing would otherwise leave its
    // linked donation dangling - still "pending" forever, with nothing
    // pointing back at the fact that the pledge itself was cancelled. Only
    // touches a donation still awaiting payment; one already confirmed
    // successful/unsuccessful (e.g. by a payment gateway) is left alone.
    if (current.offering_type === "financial" && status === "rejected") {
      const { error: donationError } = await supabase
        .from("donations")
        .update({ status: "unsuccessful", reviewed_at: new Date().toISOString() })
        .eq("gift_offering_id", id)
        .eq("status", "pending")
      if (donationError) console.warn("Gift cancel: linked donation cleanup warning:", donationError.message)
    }

    try {
      const { data: giver } = await supabase.from("givers").select("profile_id").eq("id", current.giver_id).single()
      if (giver?.profile_id) {
        await supabase.from("notifications").insert({
          recipient_id: giver.profile_id, sender_id: user.id, sender_name: "HelpLift Notifications", type: "gift_offering_reviewed",
          title: `Gift offering ${status}`,
          message: `Your offering "${current.title}" was ${status} by an administrator.${status === "approved" ? " It is now listed in the Gift Library." : cleanRejectionReason ? ` Reason: ${cleanRejectionReason}` : ""}`,
        })
      }
    } catch (notifyErr) {
      console.warn("Gift listing review notification warning:", notifyErr)
    }

    return NextResponse.json({ success: true, gift })
  } catch (err: any) {
    console.error("Admin gift update error:", err)
    return NextResponse.json({ message: "Gift update failed." }, { status: 503 })
  }
}
