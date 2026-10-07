import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// Sync-only, mirroring app/api/giver/profile/route.ts: the actual login email
// change happens client-side via supabase.auth.updateUser({ email }) +
// verifyOtp (ChangeEmailFlow in components/account-security.tsx). Once that
// succeeds, the client calls this so profiles.email - a denormalized copy set
// at registration - doesn't go stale.
export async function PATCH(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ message: "Authentication required." }, { status: 401 })
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
    if (profile?.role !== "admin") return NextResponse.json({ message: "Administrator access required." }, { status: 403 })

    const body = await request.json()
    const loginEmail = typeof body.login_email === "string" ? body.login_email.trim() : undefined
    if (!loginEmail) return NextResponse.json({ message: "login_email is required." }, { status: 400 })
    if (loginEmail.toLowerCase() !== user.email?.toLowerCase()) {
      return NextResponse.json({ message: "This email does not match your current login email. Complete the email change first." }, { status: 400 })
    }

    const { error } = await supabase.from("profiles").update({ email: loginEmail }).eq("id", user.id)
    if (error) return NextResponse.json({ message: error.message }, { status: 400 })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Admin profile sync error:", error)
    return NextResponse.json({ message: "Profile update is unavailable." }, { status: 503 })
  }
}
