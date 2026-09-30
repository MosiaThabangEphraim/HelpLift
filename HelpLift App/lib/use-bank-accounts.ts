"use client"

import { useEffect, useState } from "react"

export type BankAccountOption = {
  key: string
  bankName: string
  accountName: string
  accountNumber: string
  branchCode: string
  accountType: string
  swiftCode: string | null
}

// HelpLift's own receiving bank accounts, admin-managed (Platform Settings).
// Fetched on mount rather than imported as a constant, so an admin's edits
// show up without a redeploy.
export function useBankAccounts(): { accounts: BankAccountOption[]; isLoading: boolean } {
  const [accounts, setAccounts] = useState<BankAccountOption[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetch("/api/public/bank-accounts")
      .then(res => res.json())
      .then(data => { if (!cancelled && Array.isArray(data.accounts)) setAccounts(data.accounts) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setIsLoading(false) })
    return () => { cancelled = true }
  }, [])

  return { accounts, isLoading }
}
