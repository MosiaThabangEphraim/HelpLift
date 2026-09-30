"use client"

import { useEffect, useState } from "react"
import { AlertCircle, Banknote, CheckCircle2, Clock, FileText, Loader2, Wallet, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { formatCurrency } from "@/lib/banking"
import type { OrgRole } from "@/lib/organization-access"
import { showFeedback } from "@/lib/inline-feedback"

type Withdrawal = {
  id: string
  amount: number
  status: "pending" | "approved" | "rejected" | "paid" | "cancelled"
  rejection_reason: string | null
  proof_storage_path: string | null
  proof_file_name: string | null
  proof_url: string | null
  paid_at: string | null
  reviewed_at: string | null
  created_at: string
}

type WalletData = {
  organization_approved: boolean
  summary: { totalReceived: number; totalPaidOut: number; reserved: number; availableBalance: number }
  limits: { min: number; max: number | null }
  withdrawals: Withdrawal[]
}

const STATUS_LABEL: Record<Withdrawal["status"], string> = {
  pending: "Pending review",
  approved: "Approved - transfer in progress",
  rejected: "Declined",
  paid: "Transfer Complete",
  cancelled: "Cancelled",
}
const STATUS_CLASSES: Record<Withdrawal["status"], string> = {
  pending: "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400",
  approved: "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400",
  rejected: "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400",
  paid: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400",
  cancelled: "bg-slate-100 text-slate-600 dark:bg-[#1A2740] dark:text-slate-400",
}
const STATUS_ICON: Record<Withdrawal["status"], typeof Clock> = {
  pending: Clock,
  approved: CheckCircle2,
  rejected: XCircle,
  paid: CheckCircle2,
  cancelled: XCircle,
}

// The organization's wallet: money HelpLift has received on their behalf,
// available to withdraw via EFT to their own bank account on file. Any team
// member can view it; requesting or cancelling a withdrawal needs manager+.
export function OrganizationWallet({ memberRole }: { memberRole: OrgRole | null }) {
  const [data, setData] = useState<WalletData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [amount, setAmount] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  // Distinct from showFeedback below - this one gates the whole panel (the
  // wallet failing to load at all), so it has to be real, persistent state,
  // not a bubble that fades after a few seconds.
  const [loadError, setLoadError] = useState("")
  const [cancellingId, setCancellingId] = useState<string | null>(null)

  // Only owners may request a withdrawal (see POST /api/organization/withdrawals);
  // managers can still cancel one of their org's pending requests.
  const canRequest = memberRole === "owner"
  const canCancel = memberRole === "owner" || memberRole === "manager"

  const load = async () => {
    try {
      const res = await fetch("/api/organization/wallet")
      const json = await res.json().catch(() => ({}))
      if (res.ok) setData(json)
      else setLoadError(json.message || "Could not load your wallet.")
    } catch {
      setLoadError("Could not load your wallet.")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const requestWithdrawal = async (event: React.FormEvent) => {
    event.preventDefault()
    setIsSubmitting(true)
    try {
      const res = await fetch("/api/organization/withdrawals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: Number(amount) }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.message || "Could not submit your withdrawal request.")
      setAmount("")
      showFeedback("Withdrawal request submitted. An administrator will review it.")
      await load()
    } catch (err: any) {
      showFeedback(err.message, "error")
    } finally {
      setIsSubmitting(false)
    }
  }

  const cancelWithdrawal = async (id: string) => {
    setCancellingId(id)
    try {
      const res = await fetch(`/api/organization/withdrawals/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.message || "Could not cancel this request.")
      showFeedback("Withdrawal request cancelled.")
      await load()
    } catch (err: any) {
      showFeedback(err.message, "error")
    } finally {
      setCancellingId(null)
    }
  }

  if (isLoading) {
    return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>
  }
  if (!data) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">{loadError || "Your wallet is unavailable right now."}</p>
  }

  const { summary, limits, withdrawals, organization_approved } = data
  const effectiveMax = limits.max === null ? summary.availableBalance : Math.min(limits.max, summary.availableBalance)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-2xl border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/30 p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 flex items-center gap-1.5"><Wallet className="w-3.5 h-3.5" /> Available balance</p>
          <p className="mt-1 text-2xl font-black text-slate-900 dark:text-slate-100">{formatCurrency(summary.availableBalance)}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-[#233350] p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Received to date</p>
          <p className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-100">{formatCurrency(summary.totalReceived)}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-[#233350] p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Paid out to date</p>
          <p className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-100">{formatCurrency(summary.totalPaidOut)}</p>
        </div>
      </div>

      {!organization_approved && (
        <div className="flex items-start gap-2 rounded-2xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 p-4 text-sm text-amber-800 dark:text-amber-300">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>Your organization must be approved by an administrator before you can request a withdrawal.</span>
        </div>
      )}

      {!canRequest && organization_approved && (
        <p className="text-sm text-slate-500 dark:text-slate-400">Only owners can request a withdrawal. You can still view the wallet and withdrawal history.</p>
      )}

      {canRequest && organization_approved && (
        <form onSubmit={requestWithdrawal} className="rounded-2xl border border-slate-200 dark:border-[#233350] p-4 space-y-3">
          <p className="text-sm font-bold">Request a withdrawal</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Funds are transferred by EFT to your organization's bank account on file. Bank transfers can take up to 7 working days to reflect once sent.
            {" "}Minimum {formatCurrency(limits.min)}{limits.max !== null ? `, maximum ${formatCurrency(limits.max)}` : ""} per request.
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">R</span>
              <input
                type="number"
                min={limits.min}
                step="0.01"
                max={effectiveMax || undefined}
                required
                placeholder="0.00"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className="w-full pl-8 pr-4 py-2.5 bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#233350] rounded-xl text-sm font-semibold outline-none focus:border-blue-500 transition-colors"
              />
            </div>
            <Button type="submit" disabled={isSubmitting || summary.availableBalance < limits.min} className="bg-blue-600 hover:bg-blue-700 text-white">
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Banknote className="w-4 h-4" />}
              <span>Request withdrawal</span>
            </Button>
          </div>
        </form>
      )}

      <div className="space-y-3">
        <p className="text-sm font-bold">Withdrawal history</p>
        {withdrawals.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-300 dark:border-[#233350] p-6 text-center text-sm text-slate-500 dark:text-slate-400">
            No withdrawal requests yet.
          </p>
        ) : (
          withdrawals.map(w => {
            const Icon = STATUS_ICON[w.status]
            return (
              <div key={w.id} className="rounded-2xl border border-slate-200 dark:border-[#233350] p-4 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-bold text-base">{formatCurrency(Number(w.amount))}</span>
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${STATUS_CLASSES[w.status]}`}>
                    <Icon className="w-3.5 h-3.5" /> {STATUS_LABEL[w.status]}
                  </span>
                </div>
                <p className="text-xs text-slate-400">Requested {new Date(w.created_at).toLocaleDateString()}</p>
                {w.status === "rejected" && w.rejection_reason && (
                  <p className="text-xs italic text-red-700 dark:text-red-400">Reason: {w.rejection_reason}</p>
                )}
                {(w.status === "approved" || w.status === "paid") && (
                  <p className="text-xs text-slate-500 dark:text-slate-400">Bank transfers can take up to 7 working days to reflect once sent.</p>
                )}
                {w.status === "paid" && w.proof_url && (
                  <a href={w.proof_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:underline">
                    <FileText className="w-3.5 h-3.5" /> View proof of payment{w.paid_at ? ` · Paid ${new Date(w.paid_at).toLocaleDateString()}` : ""}
                  </a>
                )}
                {w.status === "pending" && canCancel && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={cancellingId === w.id}
                    onClick={() => cancelWithdrawal(w.id)}
                    className="text-red-600 border-red-200 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/30"
                  >
                    {cancellingId === w.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                    Cancel request
                  </Button>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
