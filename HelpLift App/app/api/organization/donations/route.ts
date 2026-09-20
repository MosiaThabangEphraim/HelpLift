import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getOrgContext, roleAtLeast, insufficientRoleMessage } from "@/lib/organization-access"

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ message: "Authentication required." }, { status: 401 })
    const orgCtx = await getOrgContext<{ id: any }>(supabase, user.id, "id")
    const org = orgCtx?.organization ?? null
    if (!org) return NextResponse.json({ message: "Organization profile not found." }, { status: 404 })

    const { data: donations, error } = await supabase
      .from("donations")
      .select("id, amount, payment_method, status, reference_code, created_at, needs(title), givers(name, email, profile_id)")
      .eq("organization_id", org.id)
      .order("created_at", { ascending: false })
    if (error) return NextResponse.json({ message: error.message }, { status: 400 })

    return NextResponse.json({ donations: donations || [] })
  } catch (error) {
    console.error("Organization donations list error:", error)
    return NextResponse.json({ message: "Donations are unavailable." }, { status: 503 })
  }
}
