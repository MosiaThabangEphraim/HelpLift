import { NextResponse } from "next/server"
import { fileUrl } from "@/lib/file-links"
import { createClient } from "@/lib/supabase/server"
import { getOrgContext, insufficientRoleMessage, roleAtLeast } from "@/lib/organization-access"
import { getWalletSummary } from "@/lib/wallet"
import { getWithdrawalLimits } from "@/lib/platform-settings"

// The organization's wallet: available balance plus its full withdrawal
// history. Managers and owners may see it (coordinators never see money); only owners may request a
// withdrawal (see POST /api/organization/withdrawals).
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ message: "Authentication required." }, { status: 401 })

    const ctx = await getOrgContext<{ id: string; verification_status: string }>(supabase, user.id, "id, verification_status")
    if (!ctx) return NextResponse.json({ message: "Organization profile not found." }, { status: 404 })
    if (!roleAtLeast(ctx.role, "manager")) return NextResponse.json({ message: insufficientRoleMessage(ctx.role, "manager") }, { status: 403 })

    const [summary, limits, { data: withdrawals, error }] = await Promise.all([
      getWalletSummary(supabase, ctx.organization.id),
      getWithdrawalLimits(supabase),
      supabase
        .from("organization_withdrawals")
        .select("id, amount, status, rejection_reason, proof_storage_path, proof_file_name, paid_at, reviewed_at, created_at")
        .eq("organization_id", ctx.organization.id)
        .order("created_at", { ascending: false }),
    ])
    if (error) return NextResponse.json({ message: error.message }, { status: 400 })

    const withProofUrls = await Promise.all(
      (withdrawals || []).map(async (w) => {
        if (!w.proof_storage_path) return { ...w, proof_url: null }
        const data = { signedUrl: fileUrl("withdrawal-proofs", w.proof_storage_path) }
        return { ...w, proof_url: data?.signedUrl || null }
      })
    )

    return NextResponse.json({
      organization_approved: ctx.organization.verification_status === "approved",
      summary,
      limits,
      withdrawals: withProofUrls,
    })
  } catch (error) {
    console.error("Organization wallet error:", error)
    return NextResponse.json({ message: "Your wallet is unavailable right now." }, { status: 503 })
  }
}
