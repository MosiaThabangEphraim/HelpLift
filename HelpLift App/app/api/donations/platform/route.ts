import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getActiveBankAccounts } from "@/lib/bank-accounts"
import { getPlatformDonationLimits } from "@/lib/platform-settings"
import { getOrgContext, roleAtLeast, insufficientRoleMessage } from "@/lib/organization-access"
import { buildPaymentFields } from "@/lib/payfast"
import { createOrder } from "@/lib/paypal"

// "Support The Platform" - a purely monetary donation to HelpLift itself,
// not to any organization or need. Both a giver and an organization (manager
// or owner - same bar as requesting a withdrawal) may make one; identified
// by donor_profile_id rather than giver_id, since an organization has no
// givers row. Goes through the exact same three payment methods (EFT,
// PayFast, PayPal) as any other donation. See
// 20260926000400_platform_donations.sql.

// A giver already sees their own platform donations mixed into
// /api/giver/donations. This is the org-side equivalent - an organization
// has no other list of donations it made (only ones it received), so
// without this a still-pending EFT platform donation an org started (and
// clicked "I'll do this later" on) would have no way to be found again.
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ message: "Authentication required." }, { status: 401 })

    const { data: donations, error } = await supabase
      .from("donations")
      .select("id, amount, payment_method, status, reference_code, bank_name, proof_storage_path, proof_uploaded_at, payer_notes, admin_notes, created_at")
      .eq("donor_profile_id", user.id)
      .eq("is_platform_donation", true)
      .order("created_at", { ascending: false })
    if (error) return NextResponse.json({ message: error.message }, { status: 400 })

    return NextResponse.json({ donations: donations || [] })
  } catch (error) {
    console.error("Platform donations list error:", error)
    return NextResponse.json({ message: "Donations are unavailable." }, { status: 503 })
  }
}
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ message: "Authentication required." }, { status: 401 })
    const { data: profile } = await supabase.from("profiles").select("role, full_name, email").eq("id", user.id).single()
    if (!profile || !["giver", "organization"].includes(profile.role)) {
      return NextResponse.json({ message: "Giver or organization access required." }, { status: 403 })
    }
    if (profile.role === "organization") {
      const orgCtx = await getOrgContext(supabase, user.id)
      if (orgCtx && !roleAtLeast(orgCtx.role, "manager")) {
        return NextResponse.json({ message: insufficientRoleMessage(orgCtx.role, "manager") }, { status: 403 })
      }
    }

    const { amount, payment_method, bank_name } = await request.json()

    const numericAmount = Number(amount)
    if (!numericAmount || numericAmount <= 0) return NextResponse.json({ message: "Enter a donation amount greater than zero." }, { status: 400 })
    if (!["eft", "payfast", "paypal"].includes(payment_method)) {
      return NextResponse.json({ message: "Invalid payment method." }, { status: 400 })
    }

    const limits = await getPlatformDonationLimits(supabase)
    if (numericAmount < limits.min) {
      return NextResponse.json({ message: `The minimum donation to the platform is R${limits.min.toFixed(2)}.` }, { status: 400 })
    }
    if (limits.max !== null && numericAmount > limits.max) {
      return NextResponse.json({ message: `The maximum donation to the platform is R${limits.max.toFixed(2)}.` }, { status: 400 })
    }

    let bankAccount = null
    if (payment_method === "eft") {
      const activeAccounts = await getActiveBankAccounts(supabase)
      bankAccount = activeAccounts.find(a => a.key === bank_name) || null
      if (!bankAccount) return NextResponse.json({ message: "Select a bank to transfer into." }, { status: 400 })
    }

    const { data: donation, error } = await supabase
      .from("donations")
      .insert({
        donor_profile_id: user.id,
        amount: numericAmount,
        payment_method,
        bank_name: payment_method === "eft" ? bank_name : null,
        is_platform_donation: true,
      })
      .select()
      .single()
    if (error) return NextResponse.json({ message: error.message }, { status: 400 })

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin
    // A platform donation can be made by a giver OR an organization (see
    // the role check above) - the return/cancel redirect has to land back
    // on whichever dashboard they actually have, not always the giver one.
    const dashboardPath = profile.role === "organization" ? "organisation-dashboard" : "givers-dashboard"

    if (payment_method === "payfast") {
      const [nameFirst, ...rest] = (profile?.full_name || "").trim().split(/\s+/)
      let payfast
      try {
        payfast = buildPaymentFields({
          returnUrl: `${siteUrl}/${dashboardPath}?tab=donations&payfast=success&donation=${donation.id}`,
          cancelUrl: `${siteUrl}/${dashboardPath}?tab=donations&payfast=cancelled&donation=${donation.id}`,
          notifyUrl: `${siteUrl}/api/public/payfast/notify`,
          nameFirst: nameFirst || undefined,
          nameLast: rest.join(" ") || undefined,
          email: profile?.email || user.email || undefined,
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
          cancelUrl: `${siteUrl}/${dashboardPath}?tab=donations&paypal=cancelled&donation=${donation.id}`,
        })
      } catch (configError: any) {
        return NextResponse.json({ message: configError.message || "PayPal is not configured." }, { status: 503 })
      }
      return NextResponse.json({ donation, paypal }, { status: 201 })
    }

    return NextResponse.json({ donation, bank: bankAccount }, { status: 201 })
  } catch (error) {
    console.error("Platform donation creation error:", error)
    return NextResponse.json({ message: "Unable to start this donation." }, { status: 503 })
  }
}
