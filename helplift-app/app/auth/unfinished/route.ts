import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

// Safety net for Google/LinkedIn/Microsoft, which are sign-in only. The sign-in
// callback (app/auth/callback) already deletes an account a provider creates
// for someone who never registered. If that ever failed, proxy.ts sends the
// still-signed-in, unfinished account here: it is deleted, signed out, and
// shown the "No account found" message on the login page.
// Only ever deletes the caller's own account, and only while it is unfinished
// (registration_complete = false) - a registered account is never touched.
export async function GET(request: Request) {
  const loginWith = (reason?: string) => NextResponse.redirect(new URL(reason ? `/login?error=${reason}` : "/login", request.url))
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return loginWith()

    const { data: profile } = await supabase.from("profiles").select("registration_complete").eq("id", user.id).maybeSingle()
    if (profile?.registration_complete !== false) return loginWith()

    await supabase.auth.signOut()
    const { error } = await createAdminClient().auth.admin.deleteUser(user.id)
    if (error) console.warn("Unfinished account clean-up failed:", error.message)
    return loginWith("no_account")
  } catch (error) {
    console.error("Unfinished account clean-up error:", error)
    return loginWith()
  }
}
