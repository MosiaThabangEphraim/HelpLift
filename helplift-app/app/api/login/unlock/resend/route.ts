import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { lockAccountAndSendCode, RESEND_COOLDOWN_MS } from "@/lib/login-lockout"

// Sends a fresh unlock code for an account that's already locked. Only
// works while locked - it's not a general "email me a code" endpoint - and
// is cooldown-limited so the resend button can't be used to spam the inbox.
export async function POST(req: Request) {
  try {
    const { email } = await req.json()
    if (!email) return NextResponse.json({ success: false, message: "Email is required." }, { status: 400 })

    const admin = createAdminClient()
    const { data: profile } = await admin.from("profiles").select("id, full_name, email, locked_until").ilike("email", email).maybeSingle()
    if (!profile || !profile.locked_until || new Date(profile.locked_until).getTime() <= Date.now()) {
      return NextResponse.json({ success: false, message: "This account isn't locked." }, { status: 400 })
    }

    const { data: lastCode } = await admin
      .from("login_lockout_codes")
      .select("created_at")
      .eq("profile_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    if (lastCode && Date.now() - new Date(lastCode.created_at).getTime() < RESEND_COOLDOWN_MS) {
      return NextResponse.json({ success: false, message: "Please wait a moment before requesting another code." }, { status: 429 })
    }

    await lockAccountAndSendCode(profile.id, profile.email, profile.full_name)
    return NextResponse.json({ success: true, message: "A new code has been sent." })
  } catch (error) {
    console.error("Login unlock resend error:", error)
    return NextResponse.json({ success: false, message: "Resend is unavailable right now." }, { status: 503 })
  }
}
