// PayPal REST API (Orders v2) helper - server-only (uses the Client
// Secret). Client-side counterpart is just `window.location.href =
// approveUrl`; unlike PayFast there's no signed hidden form to build, PayPal
// hands back a ready-to-use approval link.
//
// Academic project: sandbox only. To go live, swap the credentials for the
// Live tab's Client ID/Secret and change apiBase() to
// https://api-m.paypal.com.
//
// Currency: PayPal does not support ZAR at all (no South African Rand in its
// supported-currency list), while the rest of this app is priced in Rands.
// So the Rand amount is converted to US dollars at today's rate
// (lib/exchange-rates.ts) and PayPal charges that. The donation itself is
// still recorded in Rands. The order carries both amounts and the rate in
// its custom_id ("zar=...;usd=...;rate=..."), so the capture can be checked
// against exactly what was asked for, without storing anything extra.

import { getZarToUsdRate, zarToUsd } from "@/lib/exchange-rates"

function apiBase() {
  return "https://api-m.sandbox.paypal.com"
}

async function getAccessToken(): Promise<string> {
  const clientId = process.env.PAYPAL_SANDBOX_CLIENT_ID
  const secret = process.env.PAYPAL_SANDBOX_SECRET_KEY
  if (!clientId || !secret) throw new Error("PayPal is not configured on this server.")

  const res = await fetch(`${apiBase()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${secret}`).toString("base64")}`,
    },
    body: "grant_type=client_credentials",
  })
  if (!res.ok) throw new Error(`PayPal auth failed (${res.status}).`)
  const data = await res.json()
  return data.access_token
}

export type PaypalOrder = { id: string; approveUrl: string; usdAmount: number; zarToUsdRate: number }

// "zar=100.00;usd=5.45;rate=0.054512" - what the order was created for.
export function parseOrderAmounts(customId: unknown): { zar: number; usd: number; rate: number } | null {
  if (typeof customId !== "string") return null
  const values = Object.fromEntries(customId.split(";").map(part => part.split("=")))
  const zar = Number(values.zar), usd = Number(values.usd), rate = Number(values.rate)
  return Number.isFinite(zar) && Number.isFinite(usd) && Number.isFinite(rate) ? { zar, usd, rate } : null
}

// Creates an order and returns the link the browser should be sent to for
// the donor to approve it on paypal.com - the equivalent of PayFast's
// buildPaymentFields() "action" + signed fields.
export async function createOrder(input: {
  /** The donation in Rands - converted to US dollars here. */
  amount: number
  referenceId: string
  description: string
  returnUrl: string
  cancelUrl: string
}): Promise<PaypalOrder> {
  // Convert first: if no exchange rate can be found, nothing is created.
  const { rate } = await getZarToUsdRate()
  const usd = zarToUsd(input.amount, rate)
  const zarLabel = `R${input.amount.toFixed(2)}`

  const token = await getAccessToken()
  const res = await fetch(`${apiBase()}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [{
        reference_id: input.referenceId,
        // The donor sees the Rand amount on PayPal's page too.
        description: `${input.description} (${zarLabel})`.slice(0, 127),
        custom_id: `zar=${input.amount.toFixed(2)};usd=${usd.toFixed(2)};rate=${rate.toFixed(6)}`,
        amount: { currency_code: "USD", value: usd.toFixed(2) },
      }],
      application_context: {
        brand_name: "HelpLift",
        user_action: "PAY_NOW",
        return_url: input.returnUrl,
        cancel_url: input.cancelUrl,
      },
    }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new Error(`PayPal order creation failed (${res.status}): ${body}`)
  }
  const data = await res.json()
  const approveUrl = (data.links || []).find((l: any) => l.rel === "approve")?.href
  if (!approveUrl) throw new Error("PayPal did not return an approval link.")
  return { id: data.id, approveUrl, usdAmount: usd, zarToUsdRate: rate }
}

export type PaypalCaptureResult = {
  status: string
  /** What PayPal captured, in US dollars. */
  amount: number
  captureId: string | null
  /** What the order was created for (see parseOrderAmounts), if known. */
  ordered: { zar: number; usd: number; rate: number } | null
}

// Captures a previously-approved order - the equivalent of PayFast's
// validate() call, except here the capture call itself both confirms AND
// finalizes the payment. Called from the return route only, never from the
// client, and always with our own server-held credentials - the trust
// boundary is "we successfully called PayPal's API and it says COMPLETED",
// never anything the browser claims on its way back.
export async function captureOrder(orderId: string): Promise<PaypalCaptureResult> {
  const token = await getAccessToken()
  const res = await fetch(`${apiBase()}/v2/checkout/orders/${orderId}/capture`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    // Already-captured is not an error for our purposes - treat it as a
    // status lookup instead so a duplicate return-visit doesn't blow up.
    if (data?.details?.[0]?.issue === "ORDER_ALREADY_CAPTURED") {
      return getOrderStatus(orderId)
    }
    throw new Error(`PayPal capture failed (${res.status}): ${JSON.stringify(data)}`)
  }
  const unit = data.purchase_units?.[0]
  const capture = unit?.payments?.captures?.[0]
  return {
    status: data.status,
    amount: Number(capture?.amount?.value || 0),
    captureId: capture?.id || null,
    ordered: parseOrderAmounts(capture?.custom_id ?? unit?.custom_id),
  }
}

async function getOrderStatus(orderId: string): Promise<PaypalCaptureResult> {
  const token = await getAccessToken()
  const res = await fetch(`${apiBase()}/v2/checkout/orders/${orderId}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const data = await res.json().catch(() => ({}))
  const unit = data.purchase_units?.[0]
  const capture = unit?.payments?.captures?.[0]
  return {
    status: data.status,
    amount: Number(capture?.amount?.value || 0),
    captureId: capture?.id || null,
    ordered: parseOrderAmounts(capture?.custom_id ?? unit?.custom_id),
  }
}

export type PaypalWebhookHeaders = {
  transmissionId: string | null
  transmissionTime: string | null
  certUrl: string | null
  authAlgo: string | null
  transmissionSig: string | null
}

// Confirms a webhook POST genuinely came from PayPal - the equivalent of
// PayFast's ITN signature check + validate() call combined into one API
// call. PayPal's own docs recommend verifying via this endpoint rather than
// checking the cert chain by hand.
export async function verifyWebhookSignature(headers: PaypalWebhookHeaders, webhookEvent: unknown): Promise<boolean> {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID
  if (!webhookId) {
    console.warn("PayPal webhook: PAYPAL_WEBHOOK_ID is not configured - rejecting.")
    return false
  }
  if (!headers.transmissionId || !headers.transmissionTime || !headers.certUrl || !headers.authAlgo || !headers.transmissionSig) {
    return false
  }

  const token = await getAccessToken()
  const res = await fetch(`${apiBase()}/v1/notifications/verify-webhook-signature`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      transmission_id: headers.transmissionId,
      transmission_time: headers.transmissionTime,
      cert_url: headers.certUrl,
      auth_algo: headers.authAlgo,
      transmission_sig: headers.transmissionSig,
      webhook_id: webhookId,
      webhook_event: webhookEvent,
    }),
  })
  if (!res.ok) return false
  const data = await res.json().catch(() => ({}))
  return data.verification_status === "SUCCESS"
}
