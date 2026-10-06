// Who/where a request came from, for the admin login and activity logs.
//
// - IP: the first address in x-forwarded-for (set by Vercel and most proxies).
// - Location: Vercel adds approximate country/city headers to every request
//   for free (x-vercel-ip-country / x-vercel-ip-city). Locally they're absent,
//   so location just shows as unknown.
// - Device: a readable "Browser on OS" summary of the user agent - a best
//   guess for display, not a security signal.

export type RequestInfo = {
  ip: string | null
  country: string | null
  city: string | null
  userAgent: string | null
  device: string | null
}

export function describeDevice(userAgent: string | null | undefined): string | null {
  if (!userAgent) return null
  const ua = userAgent
  const browser =
    /Edg\//.test(ua) ? "Edge"
    : /OPR\/|Opera/.test(ua) ? "Opera"
    : /SamsungBrowser/.test(ua) ? "Samsung Internet"
    : /Firefox\//.test(ua) ? "Firefox"
    : /Chrome\//.test(ua) ? "Chrome"
    : /Safari\//.test(ua) ? "Safari"
    : /curl|wget|python|node|axios|postman/i.test(ua) ? "Script/tool"
    : "Unknown browser"
  const os =
    /Windows/.test(ua) ? "Windows"
    : /Android/.test(ua) ? "Android"
    : /iPhone|iPad|iPod/.test(ua) ? "iOS"
    : /Mac OS X|Macintosh/.test(ua) ? "macOS"
    : /CrOS/.test(ua) ? "ChromeOS"
    : /Linux/.test(ua) ? "Linux"
    : null
  return os ? `${browser} on ${os}` : browser
}

function decode(value: string | null) {
  if (!value) return null
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

export function getRequestInfo(request: Request): RequestInfo {
  const headers = request.headers
  const userAgent = headers.get("user-agent")
  return {
    ip: headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || null,
    country: headers.get("x-vercel-ip-country") || null,
    city: decode(headers.get("x-vercel-ip-city")),
    userAgent: userAgent ? userAgent.slice(0, 400) : null,
    device: describeDevice(userAgent),
  }
}
