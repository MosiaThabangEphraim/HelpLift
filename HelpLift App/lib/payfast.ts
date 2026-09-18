import crypto from "crypto"

// PayFast expects application/x-www-form-urlencoded values with spaces as
// '+' (RFC 1738), which encodeURIComponent alone does not produce.
function payfastEncode(value: string) {
  return encodeURIComponent(value).replace(/%20/g, "+")
}

// Field order matters here: PayFast signs (and expects us to sign) the
// fields in the order they're posted, not alphabetically. Callers must pass
// an object built in the order PayFast documents, and this must stay a
// plain object (not a Map) so Object.entries preserves insertion order.
//
// This is for OUTGOING requests we build ourselves (the checkout redirect):
// PayFast's rule there is to omit any variable that has no value entirely,
// so blanks are filtered before signing.
function buildParamString(data: Record<string, string | undefined | null>, passphrase?: string) {
  const pairs = Object.entries(data)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([key, v]) => `${key}=${payfastEncode(String(v))}`)
  let paramString = pairs.join("&")
  if (passphrase) paramString += `&passphrase=${payfastEncode(passphrase)}`
  return paramString
}

export function generateSignature(data: Record<string, string | undefined | null>, passphrase?: string) {
  return crypto.createHash("md5").update(buildParamString(data, passphrase)).digest("hex")
}

// For INCOMING ITN payloads: PayFast always posts a fixed set of fields
// (custom_str1-5, custom_int1-5, etc.), blank or not, and signs all of them.
// Unlike the outgoing case, we must not filter anything out here — every
// field they sent (even empty ones) has to be included, in the order
// received, or the recomputed hash won't match theirs.
export function generateItnSignature(data: Record<string, string>, passphrase?: string) {
  const pairs = Object.entries(data).map(([key, v]) => `${key}=${payfastEncode(v ?? "")}`)
  let paramString = pairs.join("&")
  if (passphrase) paramString += `&passphrase=${payfastEncode(passphrase)}`
  return crypto.createHash("md5").update(paramString).digest("hex")
}

function processUrl() {
  return process.env.PAYFAST_URL || "https://sandbox.payfast.co.za/eng/process"
}

function payfastHost() {
  try {
    return new URL(processUrl()).host
  } catch {
    return "sandbox.payfast.co.za"
  }
}

export function payfastValidateUrl() {
  return `https://${payfastHost()}/eng/query/validate`
}

export type PayfastFields = Record<string, string>

export function buildPaymentFields(input: {
  returnUrl: string
  cancelUrl: string
  notifyUrl: string
  nameFirst?: string
  nameLast?: string
  email?: string
  paymentId: string
  amount: number
  itemName: string
  itemDescription?: string
}): { action: string; fields: PayfastFields } {
  const merchantId = process.env.PAYFAST_MERCHANT_ID
  const merchantKey = process.env.PAYFAST_MERCHANT_KEY
  if (!merchantId || !merchantKey) throw new Error("PayFast is not configured on this server.")

  // Order matches PayFast's documented "Attributes for posting" sequence.
  const data: Record<string, string> = {
    merchant_id: merchantId,
    merchant_key: merchantKey,
    return_url: input.returnUrl,
    cancel_url: input.cancelUrl,
    notify_url: input.notifyUrl,
  }
  if (input.nameFirst) data.name_first = input.nameFirst
  if (input.nameLast) data.name_last = input.nameLast
  if (input.email) data.email_address = input.email
  data.m_payment_id = input.paymentId
  data.amount = input.amount.toFixed(2)
  data.item_name = input.itemName.slice(0, 100)
  if (input.itemDescription) data.item_description = input.itemDescription.slice(0, 255)

  const signature = generateSignature(data, process.env.PAYFAST_PASSPHRASE)
  return { action: processUrl(), fields: { ...data, signature } }
}
