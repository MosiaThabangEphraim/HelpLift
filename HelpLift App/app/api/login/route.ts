import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { lockAccountAndSendCode, MAX_LOGIN_ATTEMPTS } from "@/lib/login-lockout"

export async function POST(req: Request) {
  try {
    const { email, password, adminPortal } = await req.json()
    if (!email || !password) return NextResponse.json({ success: false, message: "Email and password are required." }, { status: 400 })

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
          return NextResponse.json({
            success: false,
            locked: true,
            message: "Too many incorrect attempts. Your account has been locked. We've emailed you a verification code to unlock it.",
          }, { status: 423 })
        }
        await admin.from("profiles").update({ failed_login_attempts: attempts }).eq("id", lockProfile.id)
        if (attempts === MAX_LOGIN_ATTEMPTS - 1) {
          return NextResponse.json({
            success: false,
            message: "Incorrect password. You have 1 attempt left before your account is locked.",
          }, { status: 401 })
        }
      }
      return NextResponse.json({ success: false, message: authError?.message || "Invalid email or password." }, { status: 401 })
    }

    if (lockProfile && (lockProfile.failed_login_attempts || 0) > 0) {
      await admin.from("profiles").update({ failed_login_attempts: 0, locked_until: null }).eq("id", lockProfile.id)
    }

    const { data: profile, error: profileError } = await supabase.from("profiles").select("id, full_name, email, role").eq("id", authData.user.id).single()
    if (profileError || !profile) return NextResponse.json({ success: false, message: "Your account profile is incomplete. Please contact support." }, { status: 500 })
    if (profile.role === "admin" && !adminPortal) {
      await supabase.auth.signOut()
      return NextResponse.json({ success: false, message: "Use the administrator sign-in portal." }, { status: 403 })
    }
    if (adminPortal && profile.role !== "admin") {
      await supabase.auth.signOut()
      return NextResponse.json({ success: false, message: "This account does not have administrator access." }, { status: 403 })
    }

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
