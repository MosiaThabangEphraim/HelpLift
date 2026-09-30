// HelpLift's own receiving accounts for manual EFT donations used to be a
// hardcoded BANK_ACCOUNTS constant here - an admin can now manage them
// instead (Platform Settings), so that data lives in the
// platform_bank_accounts table. See lib/bank-accounts.ts for the server-side
// type/helpers, and lib/use-bank-accounts.ts for the client-side fetch hook.

export function formatCurrency(amount: number): string {
  return `R${amount.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
