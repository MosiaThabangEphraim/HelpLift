import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ message: "Authentication required." }, { status: 401 }) }
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
  if (profile?.role !== "admin") return { error: NextResponse.json({ message: "Administrator access required." }, { status: 403 }) }
  return { user }
}

// All withdrawal requests, with the organization's bank details (the
// accountant needs these to actually send the EFT) and who requested it.
export async function GET() {
  try {
    const supabase = await createClient()
    const auth = await requireAdmin(supabase)
    if (auth.error) return auth.error

    const { data, error } = await supabase
      .from("organization_withdrawals")
      .select(`
        id, amount, status, rejection_reason, proof_storage_path, proof_file_name, paid_at, reviewed_at, created_at,
        organizations(id, name, bank_name, bank_account_holder, bank_account_number, bank_branch_code, bank_account_type),
        requester:profiles!requested_by(full_name, email)
      `)
      .order("created_at", { ascending: false })
    if (error) return NextResponse.json({ message: error.message }, { status: 400 })

    const withProofUrls = await Promise.all(
      (data || []).map(async (w: any) => {
        if (!w.proof_storage_path) return { ...w, proof_url: null }
        const { data: signed } = await supabase.storage.from("withdrawal-proofs").createSignedUrl(w.proof_storage_path, 3600)
        return { ...w, proof_url: signed?.signedUrl || null }
      })
    )

    return NextResponse.json({ withdrawals: withProofUrls })
  } catch (error) {
    console.error("Admin withdrawals list error:", error)
    return NextResponse.json({ message: "Withdrawals are unavailable." }, { status: 503 })
  }
}
