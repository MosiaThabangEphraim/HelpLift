import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { hashUnlockCode } from "@/lib/login-lockout"
import { recordLoginAttempt } from "@/lib/login-audit"

// Verifies the code emailed by lockAccountAndSendCode() and, if it matches
// an unconsumed, unexpired one for this email, clears the lockout. No
// session exists at this point (the person still isn't signed in), so this
// runs entirely on the service-role client, same as api/login.
export async function POST(req: Request) {
  try {
    const { email, code } = await req.json()
    if (!email || !code) return NextResponse.json({ success: false, message: "Email and code are required." }, { status: 400 })

    const admin = createAdminClient()
    const { data: profile } = await admin.from("profiles").select("id, locked_until").ilike("email", email).maybeSingle()
    if (!profile || !profile.locked_until) {
      return NextResponse.json({ success: false, message: "This account isn't locked." }, { status: 400 })
    }

    const codeHash = hashUnlockCode(String(code).trim())
    const { data: match } = await admin
      .from("login_lockout_codes")
      .select("id")
      .eq("profile_id", profile.id)
      .eq("code_hash", codeHash)
      .is("consumed_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!match) {
      await recordLoginAttempt(req, { email, profileId: profile.id, outcome: "unlock_failed", detail: "Incorrect or expired unlock code" })
      return NextResponse.json({ success: false, message: "That code is incorrect or has expired. Request a new one." }, { status: 400 })
    }

    await admin.from("login_lockout_codes").update({ consumed_at: new Date().toISOString() }).eq("id", match.id)
    await admin.from("profiles").update({ failed_login_attempts: 0, locked_until: null }).eq("id", profile.id)

    await recordLoginAttempt(req, { email, profileId: profile.id, outcome: "unlocked", detail: "Account unlocked with the emailed code" })
    return NextResponse.json({ success: true, message: "Account unlocked. You can now sign in." })
  } catch (error) {
    console.error("Login unlock error:", error)
    return NextResponse.json({ success: false, message: "Unlock is unavailable right now." }, { status: 503 })
  }
}
