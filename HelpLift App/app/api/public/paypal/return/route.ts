import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { reconcilePaypalOrder } from "@/lib/paypal-donation"

// PayPal redirects the donor's own browser back here after they approve -
// the fast-path confirmation, working while their browser is still around.
// Runs on the service role key and bypasses RLS, same as the PayFast ITN
// route - the trust boundary is "we successfully captured the order via
// PayPal's API," never anything the browser itself claims on its way back.
// The webhook (api/public/paypal/webhook) is the backstop for the one case
// this route can't cover: the browser never coming back at all.
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

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || origin
  const donationId = searchParams.get("donation")
  const orderId = searchParams.get("token") // PayPal's name for the order id on return

  // A donation with no giver_id and no donor_profile_id was made by a guest
  // (see 20260926000600_guest_platform_donations.sql) - they have no
  // dashboard to send back to, so send them to the homepage instead. One
  // with a donor_profile_id can be either a giver or an organization (an
  // organization has no givers row - see 20260926000400_platform_donations.sql),
  // so the redirect has to land on whichever dashboard that profile actually has.
  let isGuest = false
  let dashboardPath = "givers-dashboard"
  if (donationId) {
    const { data: donation } = await serviceClient()
      .from("donations")
      .select("giver_id, donor_profile_id")
      .eq("id", donationId)
      .single()
    isGuest = !!donation && !donation.giver_id && !donation.donor_profile_id
    if (donation?.donor_profile_id) {
      const { data: donorProfile } = await serviceClient()
        .from("profiles")
        .select("role")
        .eq("id", donation.donor_profile_id)
        .single()
      if (donorProfile?.role === "organization") dashboardPath = "organisation-dashboard"
    }
  }

  const redirect = (outcome: "success" | "cancelled") => {
    const base = isGuest
      ? `${siteUrl}/?platformDonation=${outcome}${donationId ? `&donation=${donationId}` : ""}`
      : `${siteUrl}/${dashboardPath}?tab=donations&paypal=${outcome}${donationId ? `&donation=${donationId}` : ""}`
    return NextResponse.redirect(base)
  }

  if (!donationId || !orderId) return redirect("cancelled")

  try {
    const status = await reconcilePaypalOrder(serviceClient(), { donationId, orderId })
    return redirect(status === "successful" ? "success" : "cancelled")
  } catch (error) {
    console.error("PayPal return error:", error)
    return redirect("cancelled")
  }
}
