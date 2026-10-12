import type { SupabaseClient } from "@supabase/supabase-js"

// Who's signed in, for browser code - read from the session the browser
// already holds, with no network request. supabase.auth.getUser() asks
// Supabase's auth server every time, and the many places that need to know
// "who is this?" on each page (navbar, Lifty, tour, dashboards...) were
// enough to hit Supabase's auth rate limit (429 over_request_rate_limit).
//
// Safe for deciding what to SHOW: the data itself is still protected by Row
// Level Security on every query, and server code (proxy.ts, API routes)
// verifies the user properly. Returns the same shape as getUser().
export async function getSessionUser(supabase: SupabaseClient) {
  const { data: { session } } = await supabase.auth.getSession()
  return { data: { user: session?.user ?? null } }
}
