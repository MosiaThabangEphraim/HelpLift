import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { BANK_ACCOUNTS, type BankKey } from "@/lib/banking"
import { buildPaymentFields } from "@/lib/payfast"

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ message: "Authentication required." }, { status: 401 })
    const { data: giver } = await supabase.from("givers").select("id").eq("profile_id", user.id).single()
    if (!giver) return NextResponse.json({ message: "Giver profile not found." }, { status: 404 })

    const { data: donations, error } = await supabase
      .from("donations")
      .select("id, amount, payment_method, status, reference_code, bank_name, proof_storage_path, proof_uploaded_at, payer_notes, admin_notes, reviewed_at, created_at, needs(title, organizations(name)), gift_offerings(title)")
      .eq("giver_id", giver.id)
      .order("created_at", { ascending: false })
    if (error) return NextResponse.json({ message: error.message }, { status: 400 })

    return NextResponse.json({ donations: donations || [] })
  } catch (error) {
    console.error("Donations list error:", error)
    return NextResponse.json({ message: "Donations are unavailable." }, { status: 503 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ message: "Authentication required." }, { status: 401 })
    const { data: profile } = await supabase.from("profiles").select("role, full_name, email").eq("id", user.id).single()
    if (profile?.role !== "giver") return NextResponse.json({ message: "Giver access required." }, { status: 403 })
    const { data: giver } = await supabase.from("givers").select("id").eq("profile_id", user.id).single()
    if (!giver) return NextResponse.json({ message: "Giver profile not found." }, { status: 404 })

    const { need_id, amount, payment_method, bank_name } = await request.json()

    if (!need_id) return NextResponse.json({ message: "A valid need is required." }, { status: 400 })
    const numericAmount = Number(amount)
    if (!numericAmount || numericAmount <= 0) return NextResponse.json({ message: "Enter a donation amount greater than zero." }, { status: 400 })

    if (!["eft", "payfast"].includes(payment_method)) {
      return NextResponse.json({ message: "Invalid payment method." }, { status: 400 })
    }
    if (payment_method === "eft" && (!bank_name || !Object.keys(BANK_ACCOUNTS).includes(bank_name))) {
      return NextResponse.json({ message: "Select a bank to transfer into." }, { status: 400 })
    }

    const { data: need } = await supabase.from("needs").select("id, title, organization_id, status, target_amount").eq("id", need_id).single()
    if (!need || !["open", "in_progress"].includes(need.status)) return NextResponse.json({ message: "This need is not open for donations." }, { status: 400 })
    if (need.target_amount === null || need.target_amount === undefined) {
      return NextResponse.json({ message: "This need does not accept monetary donations." }, { status: 400 })
    }

    if (payment_method === "payfast") {
      const { data: donation, error } = await supabase
        .from("donations")
        .insert({
          need_id,
          organization_id: need.organization_id,
          giver_id: giver.id,
          amount: numericAmount,
          payment_method: "payfast",
        })
        .select()
        .single()
      if (error) return NextResponse.json({ message: error.message }, { status: 400 })

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
          itemName: need.title || "HelpLift donation",
          itemDescription: `Donation to "${need.title}" via HelpLift`,
        })
      } catch (configError: any) {
        return NextResponse.json({ message: configError.message || "PayFast is not configured." }, { status: 503 })
      }

      return NextResponse.json({ donation, payfast }, { status: 201 })
    }

    const { data: donation, error } = await supabase
      .from("donations")
      .insert({
        need_id,
        organization_id: need.organization_id,
        giver_id: giver.id,
        amount: numericAmount,
        payment_method: "eft",
        bank_name: bank_name as BankKey,
      })
      .select()
      .single()
    if (error) return NextResponse.json({ message: error.message }, { status: 400 })

    return NextResponse.json({ donation, bank: BANK_ACCOUNTS[bank_name as BankKey] }, { status: 201 })
  } catch (error) {
    console.error("Donation creation error:", error)
    return NextResponse.json({ message: "Donation creation is unavailable." }, { status: 503 })
  }
}
