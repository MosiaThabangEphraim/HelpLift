import type { SupabaseClient } from "@supabase/supabase-js"

export type WalletSummary = {
  totalReceived: number
  totalPaidOut: number
  /** Pending + approved withdrawals - already spoken for, held back from the available balance. */
  reserved: number
  availableBalance: number
}

// An organization's wallet balance isn't stored anywhere - it's computed from
// the two tables that are the source of truth (confirmed donations and
// withdrawal requests), the same way every other running total in this app
// works (analytics, CSV exports). See
// supabase/migrations/20260923000200_organization_withdrawals.sql.
export async function getWalletSummary(supabase: SupabaseClient, organizationId: string): Promise<WalletSummary> {
  const [{ data: donationRows }, { data: withdrawalRows }] = await Promise.all([
    supabase.from("donations").select("amount").eq("organization_id", organizationId).eq("status", "successful"),
    supabase.from("organization_withdrawals").select("amount, status").eq("organization_id", organizationId),
  ])

  const totalReceived = (donationRows || []).reduce((sum: number, row: any) => sum + Number(row.amount || 0), 0)
  const totalPaidOut = (withdrawalRows || [])
    .filter((w: any) => w.status === "paid")
    .reduce((sum: number, w: any) => sum + Number(w.amount || 0), 0)
  const reserved = (withdrawalRows || [])
    .filter((w: any) => w.status === "pending" || w.status === "approved")
    .reduce((sum: number, w: any) => sum + Number(w.amount || 0), 0)

  return {
    totalReceived,
    totalPaidOut,
    reserved,
    availableBalance: Math.max(0, totalReceived - totalPaidOut - reserved),
  }
}
