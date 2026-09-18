import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ message: "Authentication required." }, { status: 401 })
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
    if (profile?.role !== "admin") return NextResponse.json({ message: "Admin access required." }, { status: 403 })

    const { data: donations, error } = await supabase
      .from("donations")
      .select("id, amount, payment_method, status, reference_code, bank_name, proof_storage_path, proof_uploaded_at, payer_notes, admin_notes, reviewed_at, receipt_sent_at, created_at, needs(title, organizations(name)), gift_offerings(title), givers(name, email)")
      .order("created_at", { ascending: false })
    if (error) return NextResponse.json({ message: error.message }, { status: 400 })

    return NextResponse.json({ donations: donations || [] })
  } catch (error) {
    console.error("Admin donations list error:", error)
    return NextResponse.json({ message: "Donations are unavailable." }, { status: 503 })
  }
}
