import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getOrgContext } from "@/lib/organization-access"

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ message: "Authentication required." }, { status: 401 })
    const orgCtx = await getOrgContext<{ id: any }>(supabase, user.id, "id")
    const org = orgCtx?.organization ?? null
    if (!org) return NextResponse.json({ message: "Organization profile not found." }, { status: 404 })

    const { data: claims, error } = await supabase
      .from("gift_claims")
      .select("id, motivation, status, claim_notes, created_at, gift_offerings(id, title, offering_type, description, quantity_or_value, status)")
      .eq("organization_id", org.id)
      .order("created_at", { ascending: false })
    if (error) return NextResponse.json({ claims: [] })

    return NextResponse.json({
      claims: (claims || []).map((claim: any) => {
        const gift = Array.isArray(claim.gift_offerings) ? claim.gift_offerings[0] : claim.gift_offerings
        return {
          id: claim.id,
          gift_offering_id: gift?.id,
          title: gift?.title || "Gift offering",
          offering_type: gift?.offering_type,
          description: gift?.description,
          quantity_or_value: gift?.quantity_or_value,
          motivation: claim.motivation,
          status: claim.status,
          claim_notes: claim.claim_notes,
          created_at: claim.created_at,
        }
      }),
    })
  } catch (error) {
    console.error("Organization gift claims list error:", error)
    return NextResponse.json({ claims: [] })
  }
}
