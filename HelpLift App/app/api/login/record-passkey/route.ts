import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { recordLoginAttempt } from "@/lib/login-audit"
import { logActivity } from "@/lib/activity-log"
import { isRateLimited } from "@/lib/rate-limit"

// Passkey sign-ins happen entirely in the browser (Supabase's WebAuthn
// ceremony), so the login page calls this right afterwards to record the
// successful sign-in for the admin Security tab. It only ever records a
// success for the account that is actually signed in on this session.
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ success: false }, { status: 401 })
    if (isRateLimited(`passkey-record:${user.id}`, 5, 60_000)) return NextResponse.json({ success: false }, { status: 429 })

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
    await recordLoginAttempt(request, { email: user.email, profileId: user.id, outcome: "success", method: "passkey" })
    await logActivity({ profileId: user.id, role: profile?.role, action: "Signed in", detail: "With a passkey" })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.warn("Passkey sign-in record warning:", error)
    return NextResponse.json({ success: false }, { status: 500 })
  }
}
