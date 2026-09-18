import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ message: "Authentication required." }, { status: 401 })

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
    if (profile?.role !== "admin") return NextResponse.json({ message: "Administrator access required." }, { status: 403 })

    const { data, error } = await supabase
      .from("gift_offerings")
      .select("id, title, offering_type, description, quantity_or_value, conditions, location, expiry_date, status, claim_notes, claim_motivation, created_at, givers(name, email), organizations(name)")
      .order("created_at", { ascending: false })

    if (error) {
      return NextResponse.json({ gifts: [] })
    }

    return NextResponse.json({ gifts: data || [] })
  } catch (err: any) {
    console.error("Admin gifts GET error:", err)
    return NextResponse.json({ gifts: [] })
  }
}
