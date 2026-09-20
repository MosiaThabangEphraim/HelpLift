import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// Admin overview of every fulfillment (delivery) with how much proof has been
// attached. The proof files themselves are opened through
// GET /api/fulfillments/[id], which returns signed links.
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ message: "Authentication required." }, { status: 401 })
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
    if (profile?.role !== "admin") return NextResponse.json({ message: "Administrator access required." }, { status: 403 })

    const { data, error } = await supabase
      .from("fulfillments")
      .select("id, status, notes, proof_storage_path, completed_at, created_at, organizations(id, name), givers(name, email), support_interests(needs(title))")
      .order("created_at", { ascending: false })
    if (error) return NextResponse.json({ message: error.message, fulfillments: [] }, { status: 400 })

    const ids = (data || []).map(f => f.id)
    const proofCount: Record<string, number> = {}
    if (ids.length > 0) {
      const { data: proofRows } = await supabase.from("fulfillment_proofs").select("fulfillment_id").in("fulfillment_id", ids)
      for (const row of proofRows || []) proofCount[row.fulfillment_id] = (proofCount[row.fulfillment_id] || 0) + 1
    }

    const fulfillments = (data || []).map(f => ({
      ...f,
      proof_count: proofCount[f.id] || (f.proof_storage_path ? 1 : 0),
    }))
    return NextResponse.json({ fulfillments })
  } catch (error) {
    console.error("Admin fulfillments fetch error:", error)
    return NextResponse.json({ message: "Fulfillments are unavailable.", fulfillments: [] }, { status: 503 })
  }
}
