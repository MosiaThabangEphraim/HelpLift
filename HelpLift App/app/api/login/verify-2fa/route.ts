import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { hashTwoFactorCode } from "@/lib/two-factor"

// Completes a sign-in that api/login paused for two-factor. The attempt
// token (not the email) is what proves a correct password was already
// supplied - it's the only thing api/login ever handed back, only to
// whoever just typed the right password - so this never trusts the email
// alone, unlike the code-lookup in api/login/unlock.
export async function POST(request: Request) {
  try {
    const { attemptToken, code, adminPortal } = await request.json()
    if (!attemptToken || !code) return NextResponse.json({ success: false, message: "A verification code is required." }, { status: 400 })

    const admin = createAdminClient()
    const codeHash = hashTwoFactorCode(String(code).trim())
    const { data: match } = await admin
      .from("two_factor_codes")
      .select("id, profile_id")
      .eq("attempt_token", attemptToken)
      .eq("code_hash", codeHash)
      .is("consumed_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!match) {
      return NextResponse.json({ success: false, message: "That code is incorrect or has expired. Request a new one." }, { status: 400 })
    }
    await admin.from("two_factor_codes").update({ consumed_at: new Date().toISOString() }).eq("id", match.id)

    const { data: profile } = await admin.from("profiles").select("id, full_name, email, role").eq("id", match.profile_id).single()
    if (!profile) return NextResponse.json({ success: false, message: "Account not found." }, { status: 404 })

    // The password was already confirmed correct in api/login (that's the
    // only way this attempt token could exist) - this mints the real
    // session without asking for it again, via a server-generated magic
    // link this same request immediately redeems. generateLink() never
    // emails anything itself; it just returns a token to use right here.
    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({ type: "magiclink", email: profile.email })
    if (linkError || !linkData?.properties?.hashed_token) {
      console.error("Two-factor session mint error:", linkError)
      return NextResponse.json({ success: false, message: "Could not complete sign-in. Please try again." }, { status: 503 })
    }

    const supabase = await createClient()
    const { error: verifyError } = await supabase.auth.verifyOtp({
      token_hash: linkData.properties.hashed_token,
      type: "magiclink",
    })
    if (verifyError) {
      console.error("Two-factor session verify error:", verifyError)
      return NextResponse.json({ success: false, message: "Could not complete sign-in. Please try again." }, { status: 503 })
    }

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
    console.error("Two-factor verification error:", error)
    return NextResponse.json({ success: false, message: "Verification is unavailable right now." }, { status: 503 })
  }
}
