import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { setSignupRole } from "@/lib/google-signup"
import { methodFromProvider, recordLoginAttempt } from "@/lib/login-audit"
import { logActivity } from "@/lib/activity-log"

// Where Google and LinkedIn both send the person back to (through Supabase) -
// one callback for every OAuth provider, since almost nothing here is
// actually provider-specific. Exchanges the one-time code for a session,
// then decides what happens next. Every provider is available to givers,
// organizations and administrators, but none of them ever replace
// registration: they only verify the email.
//
//   * Where they started is remembered in a short-lived "oauth_intent" cookie
//     (see lib/oauth-intent.ts) - "org" / "giver" when they had already picked
//     a type on the Register page, "admin" from the admin portal, none from
//     the normal Login page.
//   * A BRAND-NEW account from any provider is created by the database as a
//     giver whose registration is not complete. Either way they go to
//     /register/complete to fill in the rest of the normal registration and
//     choose a password. If they hadn't picked giver/organization yet (no
//     intent), that page asks first.
//   * Existing accounts just sign in and land on their dashboard.
//   * Administrators can only sign in from the admin portal, and only if an
//     admin account already exists for that email. No provider can create one.
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// On a brand-new OAuth sign-up (any provider), this route runs right after
// Supabase creates the auth.users row, which fires a database trigger
// (handle_new_user) that
// inserts the matching profiles row. That trigger is usually done by the time
// we get here, but not always instantly - so a first read that comes back
// empty doesn't necessarily mean anything is wrong; it retries briefly before
// giving up, instead of signing the person straight back out.
async function fetchProfileWithRetry(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const delays = [0, 200, 400, 800]
  for (const delay of delays) {
    if (delay) await sleep(delay)
    // select("*") so this keeps working even before newer columns exist.
    const { data: profile } = await supabase.from("profiles").select("*").eq("id", userId).single()
    if (profile) return profile
  }
  return null
}

function siteBase(request: Request) {
  const url = new URL(request.url)
  const forwardedHost = request.headers.get("x-forwarded-host")
  const forwardedProto = request.headers.get("x-forwarded-proto") || "https"
  return forwardedHost ? `${forwardedProto}://${forwardedHost}` : url.origin
}

export async function GET(request: Request) {
  const base = siteBase(request)
  const cookieStore = await cookies()
  const intent = cookieStore.get("oauth_intent")?.value
  cookieStore.delete("oauth_intent")

  const failTo = (path: string, reason: string) => NextResponse.redirect(`${base}${path}?error=${reason}`)
  const fail = (reason: string) => failTo(intent === "admin" ? "/admin-login" : "/login", reason)

  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get("code")
    if (searchParams.get("error") || !code) return fail("oauth")

    const supabase = await createClient()
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
    if (exchangeError) {
      console.warn("OAuth sign-in code exchange failed:", exchangeError.message)
      return fail("oauth")
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return fail("oauth")

    const profile = await fetchProfileWithRetry(supabase, user.id)
    const method = methodFromProvider(user.app_metadata?.provider)
    const portal = intent === "admin" ? "admin" : "user"
    const audit = (outcome: Parameters<typeof recordLoginAttempt>[1]["outcome"], detail?: string) =>
      recordLoginAttempt(request, { email: user.email, profileId: profile?.id ?? null, outcome, method, portal, detail })
    if (!profile) {
      await supabase.auth.signOut()
      return fail("profile")
    }
    const isNewSignUp = profile.registration_complete === false

    // --- Administrators: admin portal only, existing accounts only ------------
    if (intent === "admin") {
      if (profile.role !== "admin") {
        // The provider created a stray, empty account for someone who isn't
        // an administrator: remove it rather than leave it behind.
        await audit("wrong_portal", "A non-administrator account tried the administrator portal")
        if (isNewSignUp) await createAdminClient().auth.admin.deleteUser(user.id)
        await supabase.auth.signOut()
        return failTo("/admin-login", "not_admin")
      }
      await audit("success")
      await logActivity({ profileId: user.id, role: profile.role, action: "Signed in", detail: `With ${method}` })
      return NextResponse.redirect(`${base}/admin-dashboard`)
    }
    if (profile.role === "admin") {
      await audit("wrong_portal", "Administrator used the user sign-in page")
      await supabase.auth.signOut()
      return fail("admin")
    }

    // --- New OAuth sign-up: finish registration ---------------------------------
    if (isNewSignUp) {
      if (intent === "org" || intent === "giver") {
        const roleError = await setSignupRole(createAdminClient(), user, profile, intent === "org" ? "organization" : "giver")
        if (roleError) {
          console.warn("OAuth sign-up account type failed:", roleError)
          return fail("oauth")
        }
      }
      await audit("success", "New sign-up - sent to finish registration")
      return NextResponse.redirect(`${base}/register/complete`)
    }

    // --- Existing account: straight to the dashboard -----------------------------
    if (profile.role === "giver") {
      // Use their provider photo as a profile picture until they choose their
      // own - Supabase normalizes both Google's and LinkedIn's photo claim
      // into user_metadata.picture (Google also sometimes uses avatar_url).
      const picture = (user.user_metadata?.avatar_url || user.user_metadata?.picture) as string | undefined
      if (picture) {
        await supabase.from("givers").update({ avatar_url: picture }).eq("profile_id", user.id).is("avatar_url", null)
      }
    }
    await audit("success")
    await logActivity({ profileId: user.id, role: profile.role, action: "Signed in", detail: `With ${method}` })
    return NextResponse.redirect(`${base}${profile.role === "organization" ? "/organisation-dashboard" : "/givers-dashboard"}`)
  } catch (error) {
    console.error("OAuth sign-in callback error:", error)
    return fail("oauth")
  }
}
