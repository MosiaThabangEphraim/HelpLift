export type BankKey = "absa" | "fnb"

export type BankAccount = {
  key: BankKey
  bankName: string
  accountName: string
  accountNumber: string
  branchCode: string
  accountType: string
  swiftCode: string
}

// HelpLift's own receiving accounts for manual EFT donations. Donors transfer
// into one of these; the reference code ties the deposit back to a specific
// donation record for admin verification.
export const BANK_ACCOUNTS: Record<BankKey, BankAccount> = {
  absa: {
    key: "absa",
    bankName: "ABSA Bank",
    accountName: "HelpLift",
    accountNumber: "4079635021",
    branchCode: "632005",
    accountType: "Cheque Account",
    swiftCode: "ABSAZAJJ",
  },
  fnb: {
    key: "fnb",
    bankName: "First National Bank (FNB)",
    accountName: "HelpLift",
    accountNumber: "62891234567",
    branchCode: "250655",
    accountType: "Business Cheque Account",
    swiftCode: "FIRNZAJJ",
  },
}

export function formatCurrency(amount: number): string {
  return `R${amount.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
