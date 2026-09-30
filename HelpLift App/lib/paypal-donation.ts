import type { SupabaseClient } from "@supabase/supabase-js"
import { captureOrder } from "@/lib/paypal"
import { sendDonationReceipt } from "@/lib/donation-receipt"

// Captures a PayPal order and reconciles the linked donation - shared by the
// return-redirect route (fast path, works while the donor's browser is still
// around) and the webhook (backstop: fires even if the browser never comes
// back, e.g. the tab was closed right after approving). Both call this same
// function so there's exactly one place that decides what "confirmed"
// means, and calling it twice for the same order is always harmless -
// captureOrder() treats an already-captured order as a status lookup rather
// than an error, and this function only ever changes a still-pending
// donation, returning its already-resolved status otherwise.
export async function reconcilePaypalOrder(
  supabase: SupabaseClient,
  { donationId, orderId }: { donationId: string; orderId: string }
): Promise<"successful" | "unsuccessful" | null> {
  const { data: donation, error: fetchError } = await supabase
    .from("donations")
    .select("id, amount, status, payment_method, gift_offering_id, reference_code, donor_profile_id, givers(profile_id)")
    .eq("id", donationId)
    .single()
  if (fetchError || !donation || donation.payment_method !== "paypal") {
    console.warn("PayPal reconcile: donation not found or wrong method", donationId)
    return null
  }
  if (donation.status !== "pending") {
    return donation.status === "successful" ? "successful" : "unsuccessful"
  }

  const capture = await captureOrder(orderId)
  const paypalSucceeded = capture.status === "COMPLETED"
  if (paypalSucceeded && Math.abs(capture.amount - Number(donation.amount)) > 1) {
    // Wider tolerance than PayFast's - this is a ZAR amount sent to PayPal as
    // a same-numeric USD value (see lib/paypal.ts), not a real FX match.
    console.warn("PayPal reconcile: amount mismatch", { donationId, expected: donation.amount, received: capture.amount })
  }

  const newStatus: "successful" | "unsuccessful" = paypalSucceeded ? "successful" : "unsuccessful"
  const { error: updateError } = await supabase
    .from("donations")
    .update({
      status: newStatus,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", donationId)
  if (updateError) {
    console.error("PayPal reconcile: failed to update donation", donationId, updateError)
    return null
  }

  // Same cascade PayFast's ITN and the admin EFT review apply: a financial
  // Gift Library pledge's listing stays hidden until its payment clears.
  if (donation.gift_offering_id) {
    try {
      await supabase
        .from("gift_offerings")
        .update({ status: newStatus === "successful" ? "approved" : "rejected" })
        .eq("id", donation.gift_offering_id)
        .eq("status", "pending")
    } catch (cascadeErr) {
      console.warn("PayPal reconcile: gift offering cascade warning:", cascadeErr)
    }
  }

  if (newStatus === "successful") {
    try {
      const { data: adminId } = await supabase.rpc("get_any_admin_id")
      if (adminId) {
        await supabase.from("notifications").insert({
          recipient_id: adminId as unknown as string,
          type: "donation_confirmed",
          title: "PayPal donation confirmed",
          message: `A donation of R${Number(donation.amount).toFixed(2)} was confirmed automatically via PayPal.`,
        })
      }
      // A platform donation has no givers row at all (giver_id is null, even
      // for a giver or an organization donating to the platform - see
      // 20260926000400_platform_donations.sql), so fall back to
      // donor_profile_id the same way the EFT review route and the
      // receipt's own recipient lookup (loadReceiptData) already do.
      const giver = Array.isArray((donation as any).givers) ? (donation as any).givers[0] : (donation as any).givers
      const recipientProfileId = giver?.profile_id || donation.donor_profile_id
      if (recipientProfileId) {
        await supabase.from("notifications").insert({
          recipient_id: recipientProfileId,
          type: "donation_reviewed",
          title: "Donation confirmed as successful",
          message: `Your donation of R${Number(donation.amount).toFixed(2)} (ref ${donation.reference_code}) was confirmed as successful.`,
        })
      }
    } catch (notifyErr) {
      console.warn("PayPal reconcile notification warning:", notifyErr)
    }
    await sendDonationReceipt(supabase, donationId)
  }

  return newStatus
}
