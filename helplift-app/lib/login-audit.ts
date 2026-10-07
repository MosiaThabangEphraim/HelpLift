import { createAdminClient } from "@/lib/supabase/admin"
import { getRequestInfo } from "@/lib/request-info"

// Writes one row to login_attempts (see 20261006000100_login_attempts.sql)
// for the admin Security tab. Called from every sign-in path: api/login,
// api/login/verify-2fa, api/login/unlock, the OAuth callback and the passkey
// record endpoint.
//
// Best-effort: it never throws, so a logging problem (e.g. the migration not
// applied yet) can never break or slow down anyone's sign-in beyond the one insert.

export type LoginOutcome =
  | "success"
  | "wrong_password"
  | "unknown_account"
  | "locked"
  | "account_locked_now"
  | "two_factor_sent"
  | "two_factor_passed"
  | "two_factor_failed"
  | "unlocked"
  | "unlock_failed"
  | "wrong_portal"
  | "error"

export type LoginMethod = "password" | "google" | "microsoft" | "linkedin" | "passkey" | "other"

export async function recordLoginAttempt(
  request: Request,
  entry: {
    email?: string | null
    profileId?: string | null
    outcome: LoginOutcome
    method?: LoginMethod
    portal?: "user" | "admin"
    detail?: string
  }
) {
  try {
    const info = getRequestInfo(request)
    const { error } = await createAdminClient().from("login_attempts").insert({
      email: entry.email ? String(entry.email).trim().toLowerCase().slice(0, 200) : null,
      profile_id: entry.profileId || null,
      outcome: entry.outcome,
      method: entry.method || "password",
      portal: entry.portal || "user",
      ip_address: info.ip,
      country: info.country,
      city: info.city,
      user_agent: info.userAgent,
      device: info.device,
      detail: entry.detail ? entry.detail.slice(0, 300) : null,
    })
    if (error) console.warn("Login audit warning (has 20261006000100_login_attempts.sql been applied?):", error.message)
  } catch (error) {
    console.warn("Login audit warning:", error)
  }
}

// Maps Supabase's provider name to the methods we record.
export function methodFromProvider(provider: string | null | undefined): LoginMethod {
  if (provider === "google") return "google"
  if (provider === "azure") return "microsoft"
  if (provider === "linkedin_oidc" || provider === "linkedin") return "linkedin"
  return "other"
}
