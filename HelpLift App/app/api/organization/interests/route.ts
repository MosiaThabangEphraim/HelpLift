import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ message: "Authentication required." }, { status: 401 })
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
  if (profile?.role !== "organization") return NextResponse.json({ message: "Organization access required." }, { status: 403 })
  const { data: organization } = await supabase.from("organizations").select("id").eq("profile_id", user.id).single()
  if (!organization) return NextResponse.json({ message: "Organization profile not found." }, { status: 404 })
  const { data, error } = await supabase.from("support_interests").select("id, status, message, created_at, needs!inner(title, organization_id), givers(profile_id, name, email, phone, account_type)").eq("needs.organization_id", organization.id).order("created_at", { ascending: false })
  if (error) return NextResponse.json({ message: error.message }, { status: 400 })
  return NextResponse.json({ interests: data || [] })
}
