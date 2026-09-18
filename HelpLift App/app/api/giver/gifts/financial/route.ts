import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { BANK_ACCOUNTS, type BankKey } from "@/lib/banking"
import { buildPaymentFields } from "@/lib/payfast"

// A "Financial Assistance" Gift Library pledge is money, so instead of just
// creating a text listing that sits idle until an admin eyeballs it, it goes
// through the same EFT bank-transfer + proof-of-payment pipeline as a need
// donation. This creates the gift_offerings listing (status 'pending') and a
// linked donations row (status 'pending', no need/org yet) together; the
// listing only becomes visible in the Gift Library once an admin confirms the
// payment actually landed (see PATCH /api/admin/donations/[id]).
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ message: "Authentication required." }, { status: 401 })
    const { data: profile } = await supabase.from("profiles").select("role, full_name, email").eq("id", user.id).single()
    if (profile?.role !== "giver") return NextResponse.json({ message: "Giver access required." }, { status: 403 })
    const { data: giver } = await supabase.from("givers").select("id").eq("profile_id", user.id).single()
    if (!giver) return NextResponse.json({ message: "Giver profile not found." }, { status: 404 })

    const { purpose, amount, payment_method, bank_name } = await request.json()

    const numericAmount = Number(amount)
    if (!numericAmount || numericAmount <= 0) return NextResponse.json({ message: "Enter a pledge amount greater than zero." }, { status: 400 })
    if (!["eft", "payfast"].includes(payment_method)) {
      return NextResponse.json({ message: "Invalid payment method." }, { status: 400 })
    }
    if (payment_method === "eft" && (!bank_name || !Object.keys(BANK_ACCOUNTS).includes(bank_name))) {
      return NextResponse.json({ message: "Select a bank to transfer into." }, { status: 400 })
    }

    const { data: gift, error: giftError } = await supabase
      .from("gift_offerings")
      .insert({
        giver_id: giver.id,
        title: "Financial Assistance Pledge",
        offering_type: "financial",
        description: purpose?.trim() || "General financial support for a verified organization.",
        quantity_or_value: numericAmount.toFixed(2),
        status: "pending",
      })
      .select()
      .single()
    if (giftError) return NextResponse.json({ message: giftError.message }, { status: 400 })

    const { data: donation, error: donationError } = await supabase
      .from("donations")
      .insert({
        giver_id: giver.id,
        gift_offering_id: gift.id,
        amount: numericAmount,
        payment_method,
        bank_name: payment_method === "eft" ? (bank_name as BankKey) : null,
      })
      .select()
      .single()
    if (donationError) {
      // Roll back the listing so a failed pledge doesn't leave an orphaned draft.
      await supabase.from("gift_offerings").delete().eq("id", gift.id)
      return NextResponse.json({ message: donationError.message }, { status: 400 })
    }

    if (payment_method === "payfast") {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin
      const [nameFirst, ...rest] = (profile?.full_name || "").trim().split(/\s+/)
      let payfast
      try {
        payfast = buildPaymentFields({
          returnUrl: `${siteUrl}/givers-dashboard?tab=donations&payfast=success`,
          cancelUrl: `${siteUrl}/givers-dashboard?tab=donations&payfast=cancelled`,
          notifyUrl: `${siteUrl}/api/public/payfast/notify`,
          nameFirst: nameFirst || undefined,
          nameLast: rest.join(" ") || undefined,
          email: profile?.email || user.email || undefined,
          paymentId: donation.id,
          amount: numericAmount,
          itemName: "Financial Assistance Pledge",
          itemDescription: purpose?.trim() || "General financial support for a verified organization, via HelpLift",
        })
      } catch (configError: any) {
        return NextResponse.json({ message: configError.message || "PayFast is not configured." }, { status: 503 })
      }
      return NextResponse.json({ gift, donation, payfast }, { status: 201 })
    }

    return NextResponse.json({ gift, donation, bank: BANK_ACCOUNTS[bank_name as BankKey] }, { status: 201 })
  } catch (error) {
    console.error("Financial pledge creation error:", error)
    return NextResponse.json({ message: "Unable to start this pledge." }, { status: 503 })
  }
}
