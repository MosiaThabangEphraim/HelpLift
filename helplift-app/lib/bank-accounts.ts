import type { SupabaseClient } from "@supabase/supabase-js"

// HelpLift's own receiving accounts for manual EFT donations - admin-managed
// (see 20260924000100_platform_settings.sql), replacing what used to be the
// hardcoded BANK_ACCOUNTS constant here. Donors transfer into one of these;
// the reference code ties the deposit back to a specific donation record for
// admin verification.
export type PlatformBankAccount = {
  id: string
  key: string
  bankName: string
  accountName: string
  accountNumber: string
  branchCode: string
  accountType: string
  swiftCode: string | null
}

const ROW_SELECT = "id, key, bank_name, account_name, account_number, branch_code, account_type, swift_code, is_active, sort_order"

function toAccount(row: any): PlatformBankAccount {
  return {
    id: row.id,
    key: row.key,
    bankName: row.bank_name,
    accountName: row.account_name,
    accountNumber: row.account_number,
    branchCode: row.branch_code,
    accountType: row.account_type,
    swiftCode: row.swift_code,
  }
}

// Active accounts only, in display order - what a donor is offered to pay into.
export async function getActiveBankAccounts(supabase: SupabaseClient): Promise<PlatformBankAccount[]> {
  const { data, error } = await supabase
    .from("platform_bank_accounts")
    .select(ROW_SELECT)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
  if (error || !data) return []
  return data.map(toAccount)
}

// Looks up one account by its stable key (what donations.bank_name stores),
// active or not - an already-created donation should still show which
// account it was meant for even if that account is later retired.
export async function getBankAccountByKey(supabase: SupabaseClient, key: string): Promise<PlatformBankAccount | null> {
  const { data, error } = await supabase.from("platform_bank_accounts").select(ROW_SELECT).eq("key", key).maybeSingle()
  if (error || !data) return null
  return toAccount(data)
}
