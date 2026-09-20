import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

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
    const { status, claim_notes, rejection_reason } = await request.json()
    const cleanRejectionReason = typeof rejection_reason === "string" && rejection_reason.trim() ? rejection_reason.trim() : null

    if (!["pending", "approved", "pending_claim", "claimed", "expired", "rejected"].includes(status)) {
      return NextResponse.json({ message: "Invalid gift status." }, { status: 400 })
    }

    const { data: current, error: currentError } = await supabase
      .from("gift_offerings")
      .select("id, title, status, giver_id, claimed_by_org_id, organizations(name, profile_id)")
      .eq("id", id)
      .single()
    if (currentError || !current) return NextResponse.json({ message: "Gift offering not found." }, { status: 404 })

    // A claim is in review — status "approved" here means "reject the claim,
    // send it back to the pool" rather than the initial-listing approval.
    const isRejectingClaim = current.status === "pending_claim" && status === "approved"
    // Finalizing a claim: the org that requested it actually receives the item.
    const isApprovingClaim = current.status === "pending_claim" && status === "claimed"
    // First-time moderation of a goods/services listing (financial pledges are
    // moderated via the linked donation's review instead — see admin donations route).
    const isInitialModeration = current.status === "pending" && ["approved", "rejected"].includes(status)

    const payload: Record<string, any> = { status }
    if (isInitialModeration) payload.rejection_reason = status === "rejected" ? cleanRejectionReason : null
    if (isRejectingClaim) {
      payload.claimed_by_org_id = null
      payload.claim_notes = claim_notes || null
    }

    const { data: gift, error } = await supabase
      .from("gift_offerings")
      .update(payload)
      .eq("id", id)
      .select()
      .single()

    if (error) return NextResponse.json({ message: error.message }, { status: 400 })

    try {
      const orgField = (current as any).organizations
      const org = Array.isArray(orgField) ? orgField[0] : orgField
      const notifications: Record<string, any>[] = []
      const { data: giver } = await supabase.from("givers").select("profile_id").eq("id", current.giver_id).single()

      if (isApprovingClaim) {
        if (org?.profile_id) notifications.push({
          recipient_id: org.profile_id, sender_id: user.id, type: "gift_claim_approved",
          title: "Gift claim approved", message: `Your claim on "${current.title}" has been approved. Coordinate with the donor to receive it.`,
        })
        if (giver?.profile_id) notifications.push({
          recipient_id: giver.profile_id, sender_id: user.id, type: "gift_claim_approved",
          title: "Your gift offering was claimed", message: `"${current.title}" has been confirmed as claimed by ${org?.name || "an organization"}.`,
        })
      } else if (isRejectingClaim) {
        if (org?.profile_id) notifications.push({
          recipient_id: org.profile_id, sender_id: user.id, type: "gift_claim_rejected",
          title: "Gift claim declined", message: `Your claim on "${current.title}" was declined by an administrator.${claim_notes ? ` Note: ${claim_notes}` : ""}`,
        })
      } else if (isInitialModeration && giver?.profile_id) {
        notifications.push({
          recipient_id: giver.profile_id, sender_id: user.id, type: "gift_offering_reviewed",
          title: `Gift offering ${status}`,
          message: `Your offering "${current.title}" was ${status} by an administrator.${status === "approved" ? " It is now listed in the Gift Library." : cleanRejectionReason ? ` Reason: ${cleanRejectionReason}` : ""}`,
        })
      }
      if (notifications.length) await supabase.from("notifications").insert(notifications)
    } catch (notifyErr) {
      console.warn("Gift claim review notification warning:", notifyErr)
    }

    return NextResponse.json({ success: true, gift })
  } catch (err: any) {
    console.error("Admin gift update error:", err)
    return NextResponse.json({ message: "Gift update failed." }, { status: 503 })
  }
}
