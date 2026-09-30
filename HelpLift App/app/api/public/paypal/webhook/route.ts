import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { verifyWebhookSignature } from "@/lib/paypal"
import { reconcilePaypalOrder } from "@/lib/paypal-donation"

// PayPal calls this server-to-server (no browser session, no cookies) -
// this is the backstop confirmation path: it fires regardless of whether
// the donor's browser ever comes back to /api/public/paypal/return, the one
// gap that route can't cover on its own (tab closed right after approving,
// connection dropped, etc.). Runs on the service role key and bypasses RLS,
// same as the PayFast ITN route - signature verification stands in for auth.
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
    let event: any
    try {
      event = JSON.parse(rawBody)
    } catch {
      return NextResponse.json({ message: "Invalid payload." }, { status: 400 })
    }

    const verified = await verifyWebhookSignature(
      {
        transmissionId: request.headers.get("paypal-transmission-id"),
        transmissionTime: request.headers.get("paypal-transmission-time"),
        certUrl: request.headers.get("paypal-cert-url"),
        authAlgo: request.headers.get("paypal-auth-algo"),
        transmissionSig: request.headers.get("paypal-transmission-sig"),
      },
      event
    )
    if (!verified) {
      console.warn("PayPal webhook: signature verification failed", event?.id)
      return NextResponse.json({ message: "Invalid signature." }, { status: 400 })
    }

    // Only need to act on the order becoming approved - capturing it is what
    // actually confirms/finalizes the payment. reconcilePaypalOrder is fully
    // idempotent, so a duplicate event, or one that arrives after the return
    // route already captured it, is a harmless no-op.
    if (event.event_type === "CHECKOUT.ORDER.APPROVED") {
      const orderId: string | undefined = event.resource?.id
      const donationId: string | undefined = event.resource?.purchase_units?.[0]?.reference_id
      if (orderId && donationId) {
        await reconcilePaypalOrder(serviceClient(), { donationId, orderId })
      } else {
        console.warn("PayPal webhook: ORDER.APPROVED missing order id or reference_id", event.id)
      }
    }

    return new NextResponse("OK", { status: 200 })
  } catch (error) {
    console.error("PayPal webhook error:", error)
    return NextResponse.json({ message: "Webhook processing failed." }, { status: 500 })
  }
}
