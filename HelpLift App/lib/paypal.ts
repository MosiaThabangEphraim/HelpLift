// PayPal REST API (Orders v2) helper - server-only (uses the Client
// Secret). Client-side counterpart is just `window.location.href =
// approveUrl`; unlike PayFast there's no signed hidden form to build, PayPal
// hands back a ready-to-use approval link.
//
// Academic project: sandbox only. To go live, swap the credentials for the
// Live tab's Client ID/Secret and change apiBase() to
// https://api-m.paypal.com.
//
// Currency note: PayPal does not support ZAR at all (no South African Rand
// in its supported-currency list), while the rest of this app is priced in
// Rands throughout. Rather than a real FX conversion (unnecessary complexity
// for sandbox money that isn't real either way), the Rand amount is sent to
// PayPal as-is under currency code USD. This is a real limitation worth
// noting if this were ever taken beyond sandbox/demo use.

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

export type PaypalOrder = { id: string; approveUrl: string }

// Creates an order and returns the link the browser should be sent to for
// the donor to approve it on paypal.com - the equivalent of PayFast's
// buildPaymentFields() "action" + signed fields.
export async function createOrder(input: {
  amount: number
  referenceId: string
  description: string
  returnUrl: string
  cancelUrl: string
}): Promise<PaypalOrder> {
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
        description: input.description.slice(0, 127),
        amount: { currency_code: "USD", value: input.amount.toFixed(2) },
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
  return { id: data.id, approveUrl }
}

export type PaypalCaptureResult = { status: string; amount: number; captureId: string | null }

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
  const capture = data.purchase_units?.[0]?.payments?.captures?.[0]
  return {
    status: data.status,
    amount: Number(capture?.amount?.value || 0),
    captureId: capture?.id || null,
  }
}

async function getOrderStatus(orderId: string): Promise<PaypalCaptureResult> {
  const token = await getAccessToken()
  const res = await fetch(`${apiBase()}/v2/checkout/orders/${orderId}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const data = await res.json().catch(() => ({}))
  const capture = data.purchase_units?.[0]?.payments?.captures?.[0]
  return {
    status: data.status,
    amount: Number(capture?.amount?.value || 0),
    captureId: capture?.id || null,
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
