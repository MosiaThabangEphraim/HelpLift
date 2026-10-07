import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getActiveBankAccounts } from "@/lib/bank-accounts"
import { getPlatformDonationLimits } from "@/lib/platform-settings"
import { buildPaymentFields } from "@/lib/payfast"
import { createOrder } from "@/lib/paypal"

// The unregistered-visitor equivalent of /api/donations/platform - anyone
// can support the platform from the homepage without an account at all. No
// session exists to authorize this, so every check happens right here
// (amount vs. platform limits, payment method whitelist) and the write goes
// through the service-role client, exactly like the PayFast ITN / PayPal
// reconciliation / donor-cancel routes already do. See
// 20260926000600_guest_platform_donations.sql.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(request: Request) {
  try {
    const { name, email, amount, payment_method, bank_name } = await request.json()

    const guestName = String(name || "").trim()
    const guestEmail = String(email || "").trim().toLowerCase()
    if (!guestName) return NextResponse.json({ message: "Enter your name." }, { status: 400 })
    if (!guestEmail || !EMAIL_RE.test(guestEmail)) {
      return NextResponse.json({ message: "Enter a valid email address." }, { status: 400 })
    }

    const numericAmount = Number(amount)
    if (!numericAmount || numericAmount <= 0) return NextResponse.json({ message: "Enter a donation amount greater than zero." }, { status: 400 })
    if (!["eft", "payfast", "paypal"].includes(payment_method)) {
      return NextResponse.json({ message: "Invalid payment method." }, { status: 400 })
    }

    const admin = createAdminClient()

    const limits = await getPlatformDonationLimits(admin)
    if (numericAmount < limits.min) {
      return NextResponse.json({ message: `The minimum donation to the platform is R${limits.min.toFixed(2)}.` }, { status: 400 })
    }
    if (limits.max !== null && numericAmount > limits.max) {
      return NextResponse.json({ message: `The maximum donation to the platform is R${limits.max.toFixed(2)}.` }, { status: 400 })
    }

    let bankAccount = null
    if (payment_method === "eft") {
      const activeAccounts = await getActiveBankAccounts(admin)
      bankAccount = activeAccounts.find(a => a.key === bank_name) || null
      if (!bankAccount) return NextResponse.json({ message: "Select a bank to transfer into." }, { status: 400 })
    }

    const { data: donation, error } = await admin
      .from("donations")
      .insert({
        amount: numericAmount,
        payment_method,
        bank_name: payment_method === "eft" ? bank_name : null,
        is_platform_donation: true,
        guest_name: guestName,
        guest_email: guestEmail,
      })
      .select()
      .single()
    if (error) return NextResponse.json({ message: error.message }, { status: 400 })

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin

    if (payment_method === "payfast") {
      const [nameFirst, ...rest] = guestName.split(/\s+/)
      let payfast
      try {
        payfast = buildPaymentFields({
          returnUrl: `${siteUrl}/?platformDonation=success`,
          cancelUrl: `${siteUrl}/?platformDonation=cancelled&donation=${donation.id}`,
          notifyUrl: `${siteUrl}/api/public/payfast/notify`,
          nameFirst: nameFirst || undefined,
          nameLast: rest.join(" ") || undefined,
          email: guestEmail,
          paymentId: donation.id,
          amount: numericAmount,
          itemName: "Support The Platform",
          itemDescription: "Direct donation to HelpLift, via HelpLift",
        })
      } catch (configError: any) {
        return NextResponse.json({ message: configError.message || "PayFast is not configured." }, { status: 503 })
      }
      return NextResponse.json({ donation, payfast }, { status: 201 })
    }

    if (payment_method === "paypal") {
      let paypal
      try {
        paypal = await createOrder({
          amount: numericAmount,
          referenceId: donation.id,
          description: "Support The Platform - direct donation to HelpLift",
          returnUrl: `${siteUrl}/api/public/paypal/return?donation=${donation.id}`,
          cancelUrl: `${siteUrl}/?platformDonation=cancelled&donation=${donation.id}`,
        })
      } catch (configError: any) {
        return NextResponse.json({ message: configError.message || "PayPal is not configured." }, { status: 503 })
      }
      return NextResponse.json({ donation, paypal }, { status: 201 })
    }

    return NextResponse.json({ donation, bank: bankAccount }, { status: 201 })
  } catch (error) {
    console.error("Guest platform donation creation error:", error)
    return NextResponse.json({ message: "Unable to start this donation." }, { status: 503 })
  }
}
