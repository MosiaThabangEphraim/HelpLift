import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// Platform feedback (ratings and improvement ideas) for the admin's Feedback tab.
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ message: "Authentication required." }, { status: 401 })
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
    if (profile?.role !== "admin") return NextResponse.json({ message: "Administrator access required." }, { status: 403 })

    const { data, error } = await supabase
      .from("platform_feedback")
      .select("id, sender_role, sender_name, sender_email, rating, message, created_at")
      .order("created_at", { ascending: false })
      .limit(500)
    if (error) return NextResponse.json({ message: error.message, feedback: [] }, { status: 400 })
    return NextResponse.json({ feedback: data || [] })
  } catch (error) {
    console.error("Admin feedback error:", error)
    return NextResponse.json({ message: "Feedback is unavailable.", feedback: [] }, { status: 503 })
  }
}
