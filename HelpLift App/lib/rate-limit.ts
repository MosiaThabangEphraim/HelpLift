// Simple sliding-window rate limiter for the AI routes, where every request
// costs Gemini quota.
//
// The counters live in this server instance's memory - enough to stop casual
// scripting, but on a multi-instance host (e.g. Vercel) each instance counts
// separately and restarts reset it. Use a shared store (Upstash Redis, a
// Supabase table) if stricter limits are needed.

const requests = new Map<string, number[]>()

// Records a request for `key` and reports whether it is over `limit` within
// `windowMs`. Rejected requests aren't counted.
export function isRateLimited(key: string, limit: number, windowMs: number) {
  const now = Date.now()
  const recent = (requests.get(key) || []).filter(time => now - time < windowMs)
  if (recent.length >= limit) {
    requests.set(key, recent)
    return true
  }
  recent.push(now)
  requests.set(key, recent)
  // Occasionally drop idle keys so the map can't grow without bound.
  if (requests.size > 5000) {
    for (const [k, times] of requests) if (!times.some(time => now - time < windowMs)) requests.delete(k)
  }
  return false
}

export function clientIp(req: Request) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown"
}
