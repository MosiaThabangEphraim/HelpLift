import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createServerClient } from "@supabase/ssr"

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user: currentUser } } = await supabase.auth.getUser()
    if (!currentUser) return NextResponse.json({ message: "Authentication required." }, { status: 401 })
    const { data: currentProfile } = await supabase.from("profiles").select("role").eq("id", currentUser.id).single()
    if (currentProfile?.role !== "admin") return NextResponse.json({ message: "Administrator access required." }, { status: 403 })

    const { email, password, full_name } = await request.json()
    if (typeof email !== "string" || typeof password !== "string" || typeof full_name !== "string" || !email.trim() || !full_name.trim()) return NextResponse.json({ message: "Name, email, and password are required." }, { status: 400 })
    if (password.length < 8) return NextResponse.json({ message: "Password must be at least 8 characters." }, { status: 400 })

    const adminSignupClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => [], setAll: () => {} } }
    )
    const { data: signup, error: signupError } = await adminSignupClient.auth.signUp({
      email,
      password,
      options: { data: { full_name, role: "giver" } },
    })
    if (signupError || !signup.user) {
      const message = signupError?.message || "Administrator creation failed."
      return NextResponse.json({ message }, { status: /already registered|already exists/i.test(message) ? 409 : 400 })
    }
    if (!signup.session && signup.user.identities?.length === 0) {
      return NextResponse.json({ message: "An account with this email already exists." }, { status: 409 })
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .update({ full_name, role: "admin" })
      .eq("id", signup.user.id)
      .select("id, full_name, email, role")
      .single()
    if (profileError) return NextResponse.json({ message: profileError.message }, { status: 400 })
    return NextResponse.json({ profile }, { status: 201 })
  } catch (error) {
    console.error("Admin creation error:", error)
    return NextResponse.json({ message: "Administrator creation is unavailable." }, { status: 503 })
  }
}
