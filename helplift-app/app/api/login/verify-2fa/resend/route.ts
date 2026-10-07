import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendTwoFactorCode, TWO_FACTOR_RESEND_COOLDOWN_MS } from "@/lib/two-factor"

// Sends a fresh two-factor code for a pending login attempt. Keyed by the
// attempt token, not an email address, for the same reason api/login/verify-2fa
// is - knowing someone's email alone must never be enough to trigger an
// email send against their account.
export async function POST(request: Request) {
  try {
    const { attemptToken } = await request.json()
    if (!attemptToken) return NextResponse.json({ success: false, message: "Nothing to resend." }, { status: 400 })

    const admin = createAdminClient()
    const { data: lastCode } = await admin
      .from("two_factor_codes")
      .select("profile_id, created_at")
      .eq("attempt_token", attemptToken)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    if (!lastCode) return NextResponse.json({ success: false, message: "This sign-in attempt has expired. Please sign in again." }, { status: 400 })
    if (Date.now() - new Date(lastCode.created_at).getTime() < TWO_FACTOR_RESEND_COOLDOWN_MS) {
      return NextResponse.json({ success: false, message: "Please wait a moment before requesting another code." }, { status: 429 })
    }

    const { data: profile } = await admin.from("profiles").select("id, full_name, email").eq("id", lastCode.profile_id).single()
    if (!profile) return NextResponse.json({ success: false, message: "Account not found." }, { status: 404 })

    await sendTwoFactorCode(profile.id, profile.email, profile.full_name, attemptToken)
    return NextResponse.json({ success: true, message: "A new code has been sent." })
  } catch (error) {
    console.error("Two-factor resend error:", error)
    return NextResponse.json({ success: false, message: "Resend is unavailable right now." }, { status: 503 })
  }
}
