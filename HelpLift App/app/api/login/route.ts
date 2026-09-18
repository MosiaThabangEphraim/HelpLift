import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(req: Request) {
  try {
    const { email, password, adminPortal } = await req.json()
    if (!email || !password) return NextResponse.json({ success: false, message: "Email and password are required." }, { status: 400 })

    const supabase = await createClient()
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password })
    if (authError || !authData.user) return NextResponse.json({ success: false, message: authError?.message || "Invalid email or password." }, { status: 401 })

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
