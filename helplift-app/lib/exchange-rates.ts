// Live ZAR -> USD exchange rate, for PayPal (which can't charge in Rands - see
// lib/paypal.ts). Server-only. Uses free, key-less sources: Frankfurter
// (European Central Bank reference rates) first, then open.er-api.com as a
// backup. The rate is cached for an hour per server instance - reference
// rates only change about once a day.
//
// If neither source answers, ZAR_USD_FALLBACK_RATE (an optional environment
// variable, e.g. 0.055) is used; without it PayPal is refused rather than
// charging a wrong amount.

const CACHE_MS = 60 * 60 * 1000
const TIMEOUT_MS = 5000

let cached: { rate: number; at: number; source: string } | null = null

async function fromFrankfurter() {
  const res = await fetch("https://api.frankfurter.dev/v1/latest?from=ZAR&to=USD", { signal: AbortSignal.timeout(TIMEOUT_MS) })
  if (!res.ok) throw new Error(`Frankfurter ${res.status}`)
  const data = await res.json()
  return Number(data?.rates?.USD)
}

async function fromOpenErApi() {
  const res = await fetch("https://open.er-api.com/v6/latest/ZAR", { signal: AbortSignal.timeout(TIMEOUT_MS) })
  if (!res.ok) throw new Error(`open.er-api ${res.status}`)
  const data = await res.json()
  return Number(data?.rates?.USD)
}

// A believable ZAR -> USD rate - guards against a broken response.
const sensible = (rate: number) => Number.isFinite(rate) && rate > 0.005 && rate < 1

export class ExchangeRateUnavailableError extends Error {}

/** How many US dollars one Rand buys right now. */
export async function getZarToUsdRate(): Promise<{ rate: number; source: string }> {
  if (cached && Date.now() - cached.at < CACHE_MS) return { rate: cached.rate, source: cached.source }

  for (const [source, load] of [["European Central Bank (via Frankfurter)", fromFrankfurter], ["open.er-api.com", fromOpenErApi]] as const) {
    try {
      const rate = await load()
      if (sensible(rate)) {
        cached = { rate, at: Date.now(), source }
        return { rate, source }
      }
    } catch (error) {
      console.warn(`Exchange rate: ${source} failed`, error)
    }
  }

  const fallback = Number(process.env.ZAR_USD_FALLBACK_RATE)
  if (sensible(fallback)) return { rate: fallback, source: "fallback rate (ZAR_USD_FALLBACK_RATE)" }
  throw new ExchangeRateUnavailableError("We couldn't get today's exchange rate for PayPal. Please try again shortly, or use PayFast or EFT.")
}

/** A Rand amount in US dollars, rounded to cents (never below $0.01). */
export function zarToUsd(zar: number, rate: number) {
  return Math.max(0.01, Math.round(zar * rate * 100) / 100)
}
