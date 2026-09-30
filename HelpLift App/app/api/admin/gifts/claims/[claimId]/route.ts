import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// Approves or declines one claim on a Gift Library offering. An offering can
// have several pending claims at once (see 20260925000100); approving one
// automatically declines every other still-pending claim on the same
// offering (handled atomically inside review_gift_claim), so this route just
// needs to notify everyone affected afterwards.
export async function PATCH(request: Request, context: { params: Promise<{ claimId: string }> }) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ message: "Authentication required." }, { status: 401 })
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
    if (profile?.role !== "admin") return NextResponse.json({ message: "Administrator access required." }, { status: 403 })

    const { claimId } = await context.params
    const { approve, notes } = await request.json()
    if (typeof approve !== "boolean") return NextResponse.json({ message: "approve must be true or false." }, { status: 400 })
    const cleanNotes = typeof notes === "string" && notes.trim() ? notes.trim() : null

    const { data: claim, error: claimError } = await supabase
      .from("gift_claims")
      .select("id, status, gift_offering_id, organization_id, gift_offerings(title, giver_id, offering_type), organizations(name, profile_id)")
      .eq("id", claimId)
      .single()
    if (claimError || !claim) return NextResponse.json({ message: "Claim not found." }, { status: 404 })
    if (claim.status !== "pending") return NextResponse.json({ message: "This claim has already been reviewed." }, { status: 400 })

    // Whoever else is still pending on this offering gets auto-declined by
    // the RPC below when approving - read them first so we can notify them.
    let otherPendingOrgs: { profile_id: string | null; name: string | null }[] = []
    if (approve) {
      const { data: others } = await supabase
        .from("gift_claims")
        .select("organizations(name, profile_id)")
        .eq("gift_offering_id", claim.gift_offering_id)
        .eq("status", "pending")
        .neq("id", claimId)
      otherPendingOrgs = (others || []).map((row: any) => {
        const org = Array.isArray(row.organizations) ? row.organizations[0] : row.organizations
        return { profile_id: org?.profile_id ?? null, name: org?.name ?? null }
      })
    }

    const { error: rpcError } = await supabase.rpc("review_gift_claim", { p_claim_id: claimId, p_approve: approve, p_notes: cleanNotes })
    if (rpcError) return NextResponse.json({ message: rpcError.message }, { status: 400 })

    const gift = Array.isArray((claim as any).gift_offerings) ? (claim as any).gift_offerings[0] : (claim as any).gift_offerings
    const org = Array.isArray((claim as any).organizations) ? (claim as any).organizations[0] : (claim as any).organizations
    const title = gift?.title || "the offering"

    // A "financial" pledge's donation is created with organization_id null
    // (it isn't tied to any organization until one claims it - see
    // 20260914002100_gift_claims_and_financial_pledges.sql). Approving the
    // claim is the one moment to link them, so the org's donations list and
    // analytics ("Funds received") actually count it.
    if (approve) {
      const { error: linkError } = await supabase
        .from("donations")
        .update({ organization_id: claim.organization_id })
        .eq("gift_offering_id", claim.gift_offering_id)
        .is("organization_id", null)
      if (linkError) console.warn("Donation organization link warning:", linkError.message)
    }

    try {
      if (org?.profile_id) {
        const approvedMessage = gift?.offering_type === "financial"
          ? `Your claim on "${title}" has been approved. The funds now show in your Donations and Wallet.`
          : `Your claim on "${title}" has been approved. Message the donor and track delivery under your Fulfillments tab.`
        await supabase.from("notifications").insert(approve
          ? { recipient_id: org.profile_id, sender_id: user.id, sender_name: "HelpLift Notifications", type: "gift_claim_approved", title: "Gift claim approved", message: approvedMessage }
          : { recipient_id: org.profile_id, sender_id: user.id, sender_name: "HelpLift Notifications", type: "gift_claim_rejected", title: "Gift claim declined", message: `Your claim on "${title}" was declined by an administrator.${cleanNotes ? ` Note: ${cleanNotes}` : ""}` }
        )
      }
      if (approve && gift?.giver_id) {
        const { data: giver } = await supabase.from("givers").select("profile_id").eq("id", gift.giver_id).single()
        if (giver?.profile_id) {
          const giverMessage = gift?.offering_type === "financial"
            ? `"${title}" has been confirmed as claimed by ${org?.name || "an organization"}.`
            : `"${title}" has been confirmed as claimed by ${org?.name || "an organization"}. Message them and track handover under your Fulfillments tab.`
          await supabase.from("notifications").insert({
            recipient_id: giver.profile_id, sender_id: user.id, sender_name: "HelpLift Notifications", type: "gift_claim_approved",
            title: "Your gift offering was claimed", message: giverMessage,
          })
        }
      }
      for (const other of otherPendingOrgs) {
        if (other.profile_id) {
          await supabase.from("notifications").insert({
            recipient_id: other.profile_id, sender_id: user.id, sender_name: "HelpLift Notifications", type: "gift_claim_rejected",
            title: "Gift claim declined", message: `Your claim on "${title}" was declined - another organization's claim was approved.`,
          })
        }
      }
    } catch (notifyErr) {
      console.warn("Gift claim review notification warning:", notifyErr)
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error("Admin gift claim review error:", err)
    return NextResponse.json({ message: "Could not review this claim." }, { status: 503 })
  }
}

// Housekeeping only - a claim still 'pending' needs a real decision (approve
// or decline above), never just deleted out from under the organization
// that made it.
export async function DELETE(request: Request, context: { params: Promise<{ claimId: string }> }) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ message: "Authentication required." }, { status: 401 })
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
    if (profile?.role !== "admin") return NextResponse.json({ message: "Administrator access required." }, { status: 403 })

    const { claimId } = await context.params
    const { data: existing } = await supabase.from("gift_claims").select("id, status").eq("id", claimId).single()
    if (!existing) return NextResponse.json({ message: "Claim not found." }, { status: 404 })
    if (existing.status === "pending") {
      return NextResponse.json({ message: "A pending claim needs a decision first - approve or decline it, not delete." }, { status: 400 })
    }

    const { error } = await supabase.from("gift_claims").delete().eq("id", claimId)
    if (error) return NextResponse.json({ message: error.message }, { status: 400 })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Admin gift claim delete error:", error)
    return NextResponse.json({ message: "Claim deletion is unavailable." }, { status: 503 })
  }
}
