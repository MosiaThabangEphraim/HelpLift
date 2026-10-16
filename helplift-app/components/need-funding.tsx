import { formatCurrency } from "@/lib/banking"

// How much of a need is still needed (see 20261013000200_need_funding_progress.sql).
// Money: the target minus confirmed donations (needs.amount_raised, kept up to
// date by the database). Goods: the organization's own "still needed" note.

type FundingNeed = {
  target_amount?: number | string | null
  amount_raised?: number | string | null
}

/** Rand still needed, or null when the need has no money target. */
export function amountStillNeeded(need: FundingNeed): number | null {
  if (need.target_amount === null || need.target_amount === undefined || need.target_amount === "") return null
  return Math.max(0, Number(need.target_amount) - Number(need.amount_raised || 0))
}

export function isFullyFunded(need: FundingNeed): boolean {
  const left = amountStillNeeded(need)
  return left !== null && left <= 0
}

/** A slim progress bar with "R x raised of R y" and what's still needed. */
export function FundingProgress({ need, className = "" }: { need: FundingNeed; className?: string }) {
  const left = amountStillNeeded(need)
  if (left === null) return null
  const target = Number(need.target_amount)
  const raised = Math.min(target, Number(need.amount_raised || 0))
  const percent = target > 0 ? Math.round((raised / target) * 100) : 0
  return (
    <div className={`space-y-1.5 ${className}`}>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
        <div className={`h-full rounded-full ${left <= 0 ? "bg-emerald-500" : "bg-blue-600"}`} style={{ width: `${percent}%` }} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 text-xs">
        <span className="text-slate-500 dark:text-slate-400">
          <span className="font-semibold text-slate-700 dark:text-slate-200">{formatCurrency(raised)}</span> raised of {formatCurrency(target)}
        </span>
        {left <= 0 ? (
          <span className="font-bold text-emerald-600 dark:text-emerald-400">Fully funded</span>
        ) : (
          <span className="font-bold text-blue-600 dark:text-blue-400">{formatCurrency(left)} still needed</span>
        )}
      </div>
    </div>
  )
}

/** "Still needed: 40 learners" for goods, when the organization has set it. */
export function QuantityStillNeeded({ value, className = "" }: { value?: string | null; className?: string }) {
  if (!value || !value.trim()) return null
  return (
    <p className={`text-xs ${className}`}>
      <span className="font-bold text-blue-600 dark:text-blue-400">Still needed:</span>{" "}
      <span className="font-semibold text-slate-700 dark:text-slate-200">{value}</span>
    </p>
  )
}

/** Shown in place of "Donate Money" once a need's money target is met. */
export function FullyFundedTag({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-950/40 px-4 py-2 text-xs font-bold text-emerald-700 dark:text-emerald-300 ${className}`}>
      Fully funded
    </span>
  )
}
