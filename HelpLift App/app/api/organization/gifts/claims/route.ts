import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ message: "Authentication required." }, { status: 401 })
    const { data: org } = await supabase.from("organizations").select("id").eq("profile_id", user.id).single()
    if (!org) return NextResponse.json({ message: "Organization profile not found." }, { status: 404 })

    const { data: claims, error } = await supabase
      .from("gift_offerings")
      .select("id, title, offering_type, description, quantity_or_value, status, claim_notes, created_at")
      .eq("claimed_by_org_id", org.id)
      .order("created_at", { ascending: false })
    if (error) return NextResponse.json({ claims: [] })

    return NextResponse.json({ claims: claims || [] })
  } catch (error) {
    console.error("Organization gift claims list error:", error)
    return NextResponse.json({ claims: [] })
  }
}
