import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { generateItnSignature, payfastValidateUrl } from "@/lib/payfast"

// PayFast calls this server-to-server (no browser session, no cookies), so it
// runs with the service role key and bypasses RLS — the checks below (signature,
// the validate() call back to PayFast, and the amount match) are what stand in
// for auth here.
function serviceClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
      cookies: { getAll: () => [], setAll: () => {} },
    }
  )
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.text()
    const payload: Record<string, string> = {}
    for (const [key, value] of new URLSearchParams(rawBody).entries()) payload[key] = value

    const receivedSignature = payload.signature
    const { signature: _omit, ...dataForSignature } = payload
    const expectedSignature = generateItnSignature(dataForSignature, process.env.PAYFAST_PASSPHRASE)
    if (!receivedSignature || receivedSignature !== expectedSignature) {
      console.warn("PayFast ITN: signature mismatch for m_payment_id", payload.m_payment_id)
      return NextResponse.json({ message: "Invalid signature." }, { status: 400 })
    }

    // Server-to-server confirmation that this ITN really came from PayFast.
    const validateRes = await fetch(payfastValidateUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: rawBody,
    })
    const validateText = (await validateRes.text()).trim()
    if (validateText !== "VALID") {
      console.warn("PayFast ITN: validate() returned", validateText, "for m_payment_id", payload.m_payment_id)
      return NextResponse.json({ message: "Validation failed." }, { status: 400 })
    }

    const donationId = payload.m_payment_id
    if (!donationId) return NextResponse.json({ message: "Missing m_payment_id." }, { status: 400 })

    const supabase = serviceClient()
    const { data: donation, error: fetchError } = await supabase
      .from("donations")
      .select("id, amount, status, payment_method, gift_offering_id")
      .eq("id", donationId)
      .single()
    if (fetchError || !donation) {
      console.warn("PayFast ITN: donation not found", donationId)
      return NextResponse.json({ message: "Donation not found." }, { status: 404 })
    }
    if (donation.payment_method !== "payfast") {
      return NextResponse.json({ message: "Payment method mismatch." }, { status: 400 })
    }

    const grossAmount = Number(payload.amount_gross || 0)
    if (Math.abs(grossAmount - Number(donation.amount)) > 0.01) {
      console.warn("PayFast ITN: amount mismatch", { donationId, expected: donation.amount, received: grossAmount })
      return NextResponse.json({ message: "Amount mismatch." }, { status: 400 })
    }

    // Idempotent: PayFast may resend the same ITN, and only a still-pending
    // donation may have its status changed (see prevent_donation_tamper()).
    if (donation.status === "pending") {
      const newStatus = payload.payment_status === "COMPLETE" ? "successful" : "unsuccessful"
      const { error: updateError } = await supabase
        .from("donations")
        .update({
          status: newStatus,
          payfast_payment_id: payload.pf_payment_id || null,
          reviewed_at: new Date().toISOString(),
          admin_notes: `Auto-confirmed via PayFast ITN (payment_status=${payload.payment_status}).`,
        })
        .eq("id", donationId)
      if (updateError) {
        console.error("PayFast ITN: failed to update donation", donationId, updateError)
        return NextResponse.json({ message: "Update failed." }, { status: 500 })
      }

      // A financial Gift Library pledge's listing stays hidden ('pending')
      // until its payment is confirmed — same cascade the admin donation
      // review route applies for EFT, since PayFast has no admin step.
      if (donation.gift_offering_id) {
        try {
          await supabase
            .from("gift_offerings")
            .update({ status: newStatus === "successful" ? "approved" : "rejected" })
            .eq("id", donation.gift_offering_id)
            .eq("status", "pending")
        } catch (cascadeErr) {
          console.warn("PayFast ITN: gift offering cascade warning:", cascadeErr)
        }
      }

      if (newStatus === "successful") {
        try {
          const adminId = await supabase.rpc("get_any_admin_id")
          if (adminId.data) {
            await supabase.from("notifications").insert({
              recipient_id: adminId.data,
              type: "donation_confirmed",
              title: "PayFast donation confirmed",
              message: `A donation of R${Number(donation.amount).toFixed(2)} was confirmed automatically via PayFast.`,
            })
          }
        } catch (notifyErr) {
          console.warn("PayFast ITN notification warning:", notifyErr)
        }
      }
    }

    return new NextResponse("OK", { status: 200 })
  } catch (error) {
    console.error("PayFast ITN error:", error)
    return NextResponse.json({ message: "ITN processing failed." }, { status: 500 })
  }
}
