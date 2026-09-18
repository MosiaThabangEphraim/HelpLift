import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ message: "Authentication required." }, { status: 401 })

    const { data: org } = await supabase
      .from("organizations")
      .select("id, name, verification_status")
      .eq("profile_id", user.id)
      .single()

    if (!org) return NextResponse.json({ message: "Organization account required." }, { status: 403 })
    if (org.verification_status !== "approved") {
      return NextResponse.json({ message: "Your organization must be approved by an administrator before claiming offerings." }, { status: 403 })
    }

    const { id } = await context.params
    const body = await request.json().catch(() => ({}))
    const motivation = typeof body.motivation === "string" ? body.motivation.trim().slice(0, 1000) : null

    const { data: gift, error: lookupError } = await supabase
      .from("gift_offerings")
      .select("id, status, giver_id, title")
      .eq("id", id)
      .single()

    if (lookupError || !gift) {
      return NextResponse.json({ message: "Gift offering not found." }, { status: 404 })
    }

    if (gift.status !== "approved") {
      return NextResponse.json({ message: "This offering is no longer available." }, { status: 400 })
    }

    const { data: updated, error: updateError } = await supabase
      .from("gift_offerings")
      .update({
        status: "pending_claim",
        claimed_by_org_id: org.id,
        claim_motivation: motivation,
      })
      .eq("id", id)
      .select()
      .single()

    if (updateError) return NextResponse.json({ message: updateError.message }, { status: 400 })

    // Notify the giver (informational) and an admin (action required) that this
    // claim now needs review — finalized only once an admin approves it.
    try {
      const { data: giver } = await supabase.from("givers").select("profile_id").eq("id", gift.giver_id).single()
      if (giver?.profile_id) {
        await supabase.rpc("send_notification", {
          p_recipient: giver.profile_id,
          p_type: "gift_claim_requested",
          p_title: "Your gift offering has a claim request",
          p_message: `${org.name} would like to claim your offering "${gift.title}". A HelpLift administrator will review and confirm this claim.`,
        })
      }
      const { data: adminId } = await supabase.rpc("get_any_admin_id")
      if (adminId) {
        await supabase.rpc("send_notification", {
          p_recipient: adminId as unknown as string,
          p_type: "gift_claim_requested",
          p_title: "Gift offering claim needs approval",
          p_message: `${org.name} wants to claim "${gift.title}".${motivation ? ` Motivation: ${motivation}` : ""}`,
        })
      }
    } catch (notifErr) {
      console.warn("Notification error during gift claim:", notifErr)
    }

    return NextResponse.json({ success: true, gift: updated })
  } catch (err: any) {
    console.error("Claim gift exception:", err)
    return NextResponse.json({ message: "Unable to claim offering at this time." }, { status: 503 })
  }
}
