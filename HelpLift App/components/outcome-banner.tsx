"use client"

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Check, X, AlertTriangle } from "lucide-react"
import { formatCurrency } from "@/lib/banking"

// A dismissible pop-up for how a donation/pledge attempt ended - used both
// right after returning from PayFast/PayPal, and right after submitting an
// EFT proof of payment for verification. Same "pops up over the screen,
// dismiss any way you like" pattern as the admin announcement popup
// (app/login/page.tsx) - closing via the X, clicking outside, Escape, or a
// button all call onDismiss the same way.
const VARIANT = {
  success: {
    Icon: Check,
    iconRing: "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400",
    heading: "Thank You for Making a Difference!",
    pill: "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400",
    pillText: "Your donation was successful.",
    closing: "Thank you for being part of something meaningful.",
    primaryClass: "bg-emerald-600 hover:bg-emerald-700 text-white",
  },
  pending: {
    Icon: Check,
    iconRing: "bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400",
    heading: "Thank You for Your Generosity!",
    pill: "bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400",
    pillText: "Submitted for admin review.",
    closing: "Thank you for being part of something meaningful.",
    primaryClass: "bg-amber-600 hover:bg-amber-700 text-white",
  },
  unsuccessful: {
    Icon: X,
    iconRing: "bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400",
    heading: "Payment Unsuccessful",
    pill: null,
    pillText: null,
    closing: "Your willingness to help still matters.",
    primaryClass: "bg-red-600 hover:bg-red-700 text-white",
  },
} as const

const POSSIBLE_REASONS = ["Insufficient funds", "Incorrect card or account details", "Network or bank issue", "Transaction was declined"]

type OutcomeBannerProps = {
  variant: "success" | "unsuccessful" | "pending"
  message: string
  onDismiss: () => void
  /** The confirmed/submitted donation's own details, shown as a small receipt-style card - omit where not cheaply available (e.g. a guest return with no session to look it up from). */
  detail?: { amount: number; date: string; reference: string }
}

// A cascading entrance - each element appears a beat after the one before
// it, rather than the whole card just fading in as one flat block. Success
// and pending get a livelier feel (the icon keeps bouncing); unsuccessful
// settles in calmly instead, on purpose - a bouncy entrance over a failed
// payment would read as tone-deaf.
function OutcomeContent({ variant, message, onDismiss, detail }: OutcomeBannerProps) {
  const v = VARIANT[variant]
  const lively = variant !== "unsuccessful"
  return (
    <div className="space-y-5 pt-2 text-center">
      <div className="mx-auto h-20 w-20 animate-in zoom-in-50 fade-in duration-500">
        <div className={`flex h-20 w-20 items-center justify-center rounded-full ${v.iconRing} ${lively ? "animate-bounce" : ""}`}>
          <v.Icon className="h-9 w-9" strokeWidth={3} />
        </div>
      </div>

      <div
        className="space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-500"
        style={{ animationDelay: "150ms", animationFillMode: "backwards" }}
      >
        <h3 className="text-xl font-extrabold text-slate-900 dark:text-slate-100">{v.heading}</h3>
        {v.pill && (
          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${v.pill}`}>
            <Check className="h-3.5 w-3.5" /> {v.pillText}
          </span>
        )}
      </div>

      <p
        className="text-sm leading-relaxed text-slate-600 dark:text-slate-300 animate-in fade-in slide-in-from-bottom-2 duration-500"
        style={{ animationDelay: "300ms", animationFillMode: "backwards" }}
      >
        {message}
      </p>
      <p
        className="text-sm font-bold text-slate-800 dark:text-slate-100 animate-in fade-in slide-in-from-bottom-2 duration-500"
        style={{ animationDelay: "450ms", animationFillMode: "backwards" }}
      >
        {v.closing}
      </p>

      {detail && (
        <div
          className="rounded-2xl border border-slate-200 dark:border-[#233350] p-4 text-left text-sm space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-500"
          style={{ animationDelay: "600ms", animationFillMode: "backwards" }}
        >
          <div className="flex items-center justify-between">
            <span className="text-slate-500 dark:text-slate-400">Amount</span>
            <span className="font-bold">{formatCurrency(detail.amount)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500 dark:text-slate-400">Date</span>
            <span className="font-bold">{detail.date}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500 dark:text-slate-400">Reference</span>
            <span className="font-mono font-bold">{detail.reference}</span>
          </div>
        </div>
      )}

      {variant === "unsuccessful" && (
        <div
          className="rounded-2xl border border-red-100 dark:border-red-900/60 bg-red-50/60 dark:bg-red-950/20 p-4 text-left space-y-1.5 animate-in fade-in slide-in-from-bottom-2 duration-500"
          style={{ animationDelay: "600ms", animationFillMode: "backwards" }}
        >
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-red-700 dark:text-red-400">
            <AlertTriangle className="h-3.5 w-3.5" /> Possible reasons
          </p>
          <ul className="space-y-1 text-xs text-red-700/90 dark:text-red-300/90">
            {POSSIBLE_REASONS.map((reason) => (
              <li key={reason}>• {reason}</li>
            ))}
          </ul>
        </div>
      )}

      <div
        className="pt-1 animate-in fade-in duration-500"
        style={{ animationDelay: "750ms", animationFillMode: "backwards" }}
      >
        <Button type="button" onClick={onDismiss} className={`w-full ${v.primaryClass}`}>
          Close
        </Button>
      </div>
    </div>
  )
}

export function OutcomeBanner(props: OutcomeBannerProps) {
  return (
    <Dialog open onOpenChange={(open) => !open && props.onDismiss()}>
      <DialogContent className="sm:max-w-sm">
        <DialogTitle className="sr-only">{VARIANT[props.variant].heading}</DialogTitle>
        <OutcomeContent {...props} />
      </DialogContent>
    </Dialog>
  )
}

// Same pop-up, without its own Dialog wrapper - for a spot that's already
// inside an open dialog (the EFT "done" step of a donation dialog), where
// nesting a second Dialog inside the first would stack two overlays instead
// of replacing the content in place.
export function OutcomeContentInline(props: OutcomeBannerProps) {
  return <OutcomeContent {...props} />
}
