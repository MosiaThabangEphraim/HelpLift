import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { setSignupRole } from "@/lib/google-signup"

// Where Google sends the person back to (through Supabase). Exchanges the
// one-time code for a session, then decides what happens next. Google is
// available to givers, organizations and administrators, but it never replaces
// registration: it only verifies the email.
//
//   * Where they started is remembered in a short-lived "google_intent" cookie
//     ("org" / "giver" when they had already picked a type on the Register page,
//     "admin" from the admin portal, none from the normal Login page).
//   * A BRAND-NEW Google account is created by the database as a giver whose
//     registration is not complete. Either way they go to /register/complete to
//     fill in the rest of the normal registration and choose a password. If they
//     hadn't picked giver/organization yet (no intent), that page asks first.
//   * Existing accounts just sign in and land on their dashboard.
//   * Administrators can only sign in from the admin portal, and only if an admin
//     account already exists for that Google email. Google can never create one.
function siteBase(request: Request) {
  const url = new URL(request.url)
  const forwardedHost = request.headers.get("x-forwarded-host")
  const forwardedProto = request.headers.get("x-forwarded-proto") || "https"
  return forwardedHost ? `${forwardedProto}://${forwardedHost}` : url.origin
}

export async function GET(request: Request) {
  const base = siteBase(request)
  const cookieStore = await cookies()
  const intent = cookieStore.get("google_intent")?.value
  cookieStore.delete("google_intent")

  const failTo = (path: string, reason: string) => NextResponse.redirect(`${base}${path}?error=${reason}`)
  const fail = (reason: string) => failTo(intent === "admin" ? "/admin-login" : "/login", reason)

  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get("code")
    if (searchParams.get("error") || !code) return fail("google")

    const supabase = await createClient()
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
    if (exchangeError) {
      console.warn("Google sign-in code exchange failed:", exchangeError.message)
      return fail("google")
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return fail("google")

    // select("*") so this keeps working even before newer columns exist.
    const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single()
    if (!profile) {
      await supabase.auth.signOut()
      return fail("profile")
    }
    const isNewSignUp = profile.registration_complete === false

    // --- Administrators: admin portal only, existing accounts only ------------
    if (intent === "admin") {
      if (profile.role !== "admin") {
        // Google created a stray, empty account for someone who isn't an
        // administrator: remove it rather than leave it behind.
        if (isNewSignUp) await createAdminClient().auth.admin.deleteUser(user.id)
        await supabase.auth.signOut()
        return failTo("/admin-login", "not_admin")
      }
      return NextResponse.redirect(`${base}/admin-dashboard`)
    }
    if (profile.role === "admin") {
      await supabase.auth.signOut()
      return fail("admin")
    }

    // --- New Google sign-up: finish registration ---------------------------------
    if (isNewSignUp) {
      if (intent === "org" || intent === "giver") {
        const roleError = await setSignupRole(createAdminClient(), user, profile, intent === "org" ? "organization" : "giver")
        if (roleError) {
          console.warn("Google sign-up account type failed:", roleError)
          return fail("google")
        }
      }
      return NextResponse.redirect(`${base}/register/complete`)
    }

    // --- Existing account: straight to the dashboard -----------------------------
    if (profile.role === "giver") {
      // Use their Google photo as a profile picture until they choose their own.
      const picture = (user.user_metadata?.avatar_url || user.user_metadata?.picture) as string | undefined
      if (picture) {
        await supabase.from("givers").update({ avatar_url: picture }).eq("profile_id", user.id).is("avatar_url", null)
      }
    }
    return NextResponse.redirect(`${base}${profile.role === "organization" ? "/organisation-dashboard" : "/givers-dashboard"}`)
  } catch (error) {
    console.error("Google sign-in callback error:", error)
    return fail("google")
  }
}
