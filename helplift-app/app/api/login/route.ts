import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { lockAccountAndSendCode, MAX_LOGIN_ATTEMPTS } from "@/lib/login-lockout"
import { sendTwoFactorCode } from "@/lib/two-factor"
import { recordLoginAttempt } from "@/lib/login-audit"
import { logActivity } from "@/lib/activity-log"

export async function POST(req: Request) {
  try {
    const { email, password, adminPortal } = await req.json()
    if (!email || !password) return NextResponse.json({ success: false, message: "Email and password are required." }, { status: 400 })
    // Every outcome below is recorded for the admin Security tab (lib/login-audit.ts).
    const portal = adminPortal ? "admin" : "user"
    const audit = (outcome: Parameters<typeof recordLoginAttempt>[1]["outcome"], profileId?: string | null, detail?: string) =>
      recordLoginAttempt(req, { email, profileId, outcome, method: "password", portal, detail })

    // Only a REGISTERED email gets tracked/locked at all - there's no
    // profile row to count attempts against otherwise, and doing so would
    // let an attacker learn which emails exist from the response shape.
    const admin = createAdminClient()
    const { data: lockProfile } = await admin
      .from("profiles")
      .select("id, full_name, email, failed_login_attempts, locked_until")
      .ilike("email", email)
      .maybeSingle()

    if (lockProfile?.locked_until && new Date(lockProfile.locked_until).getTime() > Date.now()) {
      await audit("locked", lockProfile.id, "Tried to sign in while the account was locked")
      return NextResponse.json({
        success: false,
        locked: true,
        message: "Your account is locked after too many incorrect attempts. Enter the verification code we emailed you to unlock it.",
      }, { status: 423 })
    }

    const supabase = await createClient()
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError || !authData.user) {
      if (lockProfile) {
        const attempts = (lockProfile.failed_login_attempts || 0) + 1
        if (attempts >= MAX_LOGIN_ATTEMPTS) {
          await lockAccountAndSendCode(lockProfile.id, lockProfile.email, lockProfile.full_name)
          await audit("account_locked_now", lockProfile.id, `Locked after ${attempts} incorrect attempts`)
          return NextResponse.json({
            success: false,
            locked: true,
            message: "Too many incorrect attempts. Your account has been locked. We've emailed you a verification code to unlock it.",
          }, { status: 423 })
        }
        await admin.from("profiles").update({ failed_login_attempts: attempts }).eq("id", lockProfile.id)
        await audit("wrong_password", lockProfile.id, `Attempt ${attempts} of ${MAX_LOGIN_ATTEMPTS}${authError?.message && !/invalid login credentials/i.test(authError.message) ? ` - ${authError.message}` : ""}`)
        if (attempts === MAX_LOGIN_ATTEMPTS - 1) {
          return NextResponse.json({
            success: false,
            message: "Incorrect password. You have 1 attempt left before your account is locked.",
          }, { status: 401 })
        }
      }
      if (!lockProfile) await audit("unknown_account", null, "No account with this email")
      return NextResponse.json({ success: false, message: authError?.message || "Invalid email or password." }, { status: 401 })
    }

    if (lockProfile && (lockProfile.failed_login_attempts || 0) > 0) {
      await admin.from("profiles").update({ failed_login_attempts: 0, locked_until: null }).eq("id", lockProfile.id)
    }

    const { data: profile, error: profileError } = await supabase.from("profiles").select("id, full_name, email, role, two_factor_enabled").eq("id", authData.user.id).single()
    if (profileError || !profile) return NextResponse.json({ success: false, message: "Your account profile is incomplete. Please contact support." }, { status: 500 })
    if (profile.role === "admin" && !adminPortal) {
      await supabase.auth.signOut()
      await audit("wrong_portal", profile.id, "Administrator used the user sign-in page")
      return NextResponse.json({ success: false, message: "Use the administrator sign-in portal." }, { status: 403 })
    }
    if (adminPortal && profile.role !== "admin") {
      await supabase.auth.signOut()
      await audit("wrong_portal", profile.id, `A ${profile.role} account tried the administrator portal`)
      return NextResponse.json({ success: false, message: "This account does not have administrator access." }, { status: 403 })
    }

    // Admin accounts are exempt - no option to turn it on, two_factor_enabled
    // is simply never consulted for this role.
    if (profile.two_factor_enabled && profile.role !== "admin") {
      // Password just checked out, but the second factor hasn't - no usable
      // session should exist until it does, so the one Supabase just
      // created is torn down immediately. api/login/verify-2fa is the only
      // way back in from here, and it needs the attempt token below (not
      // just the emailed code) to do it.
      await supabase.auth.signOut()
      const attemptToken = await sendTwoFactorCode(profile.id, profile.email, profile.full_name)
      await audit("two_factor_sent", profile.id, "Correct password - two-factor code emailed")
      return NextResponse.json({
        success: false,
        twoFactorRequired: true,
        attemptToken,
        email: profile.email,
        message: "Enter the verification code we emailed you to finish signing in.",
      }, { status: 401 })
    }

    await audit("success", profile.id)
    await logActivity({ profileId: profile.id, role: profile.role, action: "Signed in", detail: "Email and password" })
    return NextResponse.json({
      success: true,
      message: "Login successful",
      user: { id: profile.id, email: profile.email, fullName: profile.full_name, role: profile.role },
    })
  } catch (error) {
    console.error("Supabase login error:", error)
    return NextResponse.json({ success: false, message: "Login is unavailable right now." }, { status: 503 })
  }
}
