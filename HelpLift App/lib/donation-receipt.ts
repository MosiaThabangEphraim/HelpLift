import type { SupabaseClient } from "@supabase/supabase-js"
import { sendEmail } from "@/lib/mailer"
import { generateReceiptPdf, type ReceiptData } from "@/lib/receipt-pdf"

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  eft: "Bank Transfer (EFT)",
  payfast: "PayFast",
  paypal: "PayPal",
}

type ReceiptLookup =
  | { data: ReceiptData; giverEmail: string; referenceCode: string }
  | { error: string; status: number }

// Shared by the admin's manual preview/(re)send endpoint and the automatic
// send (EFT: right after an admin confirms the donation; PayFast: right
// after its ITN confirms payment) - one place building the receipt, so both
// paths produce exactly the same PDF and email.
export async function loadReceiptData(supabase: SupabaseClient, id: string): Promise<ReceiptLookup> {
  const { data: donation, error } = await supabase
    .from("donations")
    .select("id, amount, payment_method, status, reference_code, reviewed_at, created_at, is_platform_donation, donor_profile_id, guest_name, guest_email, needs(title), gift_offerings(title), organizations(name), givers(name, email)")
    .eq("id", id)
    .single()
  if (error || !donation) return { error: "Donation not found.", status: 404 }
  if (donation.status !== "successful") {
    return { error: "A receipt is only available for a successful donation.", status: 400 }
  }

  // A platform donation has no givers row (giver_id is null even when the
  // donor is a giver - see 20260926000400_platform_donations.sql) - resolve
  // the donor through donor_profile_id instead, or guest_name/guest_email
  // directly for someone who donated without an account at all (see
  // 20260926000600_guest_platform_donations.sql).
  let giver: { name: string; email: string } | null = Array.isArray(donation.givers) ? donation.givers[0] : donation.givers
  if (!giver && donation.donor_profile_id) {
    const { data: donorProfile } = await supabase.from("profiles").select("full_name, email").eq("id", donation.donor_profile_id).single()
    if (donorProfile) giver = { name: donorProfile.full_name, email: donorProfile.email }
  }
  if (!giver && donation.guest_email) {
    giver = { name: donation.guest_name || "Supporter", email: donation.guest_email }
  }
  if (!giver?.email) return { error: "This donor has no email address on file.", status: 400 }

  const org = Array.isArray(donation.organizations) ? donation.organizations[0] : donation.organizations
  const need = Array.isArray(donation.needs) ? donation.needs[0] : donation.needs
  const gift = Array.isArray(donation.gift_offerings) ? donation.gift_offerings[0] : donation.gift_offerings
  const description = donation.is_platform_donation
    ? "Support The Platform - direct donation to HelpLift"
    : need?.title || (gift?.title ? `Gift Library pledge - ${gift.title}` : "General donation")

  const confirmedAt = new Date(donation.reviewed_at || donation.created_at).toLocaleDateString("en-ZA", {
    year: "numeric", month: "long", day: "numeric",
  })

  return {
    data: {
      referenceCode: donation.reference_code,
      amount: Number(donation.amount),
      paymentMethod: PAYMENT_METHOD_LABELS[donation.payment_method] || donation.payment_method,
      confirmedAt,
      giverName: giver.name,
      giverEmail: giver.email,
      orgName: org?.name || null,
      description,
      isPlatformDonation: donation.is_platform_donation,
    },
    giverEmail: giver.email,
    referenceCode: donation.reference_code,
  }
}

// Generates the PDF, emails it, and records receipt_sent_at. Never throws -
// callers that trigger this automatically (donation approval, PayFast ITN)
// shouldn't fail the whole request over a receipt email hiccup; an admin can
// always resend manually afterwards (see .../receipt POST).
export async function sendDonationReceipt(supabase: SupabaseClient, id: string): Promise<{ success: boolean; message?: string; receipt_sent_at?: string }> {
  try {
    const result = await loadReceiptData(supabase, id)
    if ("error" in result) return { success: false, message: result.error }

    const pdfBuffer = await generateReceiptPdf(result.data)
    await sendEmail({
      to: result.giverEmail,
      subject: `Your HelpLift donation receipt (${result.referenceCode})`,
      text: `Hi ${result.data.giverName},\n\nThank you for your donation of R${result.data.amount.toFixed(2)} (ref ${result.referenceCode}). Your receipt is attached as a PDF.\n\n- The HelpLift team`,
      html: `
        <p>Hi ${result.data.giverName},</p>
        <p>Thank you for your donation - your receipt is attached as a PDF.</p>
        <p><strong>Reference:</strong> ${result.referenceCode}</p>
        <p>- The HelpLift team</p>
      `,
      attachments: [{ name: `HelpLift-Receipt-${result.referenceCode}.pdf`, content: pdfBuffer.toString("base64") }],
    })

    const sentAt = new Date().toISOString()
    await supabase.from("donations").update({ receipt_sent_at: sentAt }).eq("id", id)
    return { success: true, receipt_sent_at: sentAt }
  } catch (error: any) {
    console.warn("Donation receipt send warning:", error)
    return { success: false, message: error?.message || "Unable to send the receipt." }
  }
}
