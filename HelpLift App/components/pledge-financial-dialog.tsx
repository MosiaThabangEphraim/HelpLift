"use client"

import { useState } from "react"
import { Banknote, CheckCircle2, Clock, CreditCard, Loader2, Sparkles, UploadCloud } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { BANK_ACCOUNTS, formatCurrency, type BankKey } from "@/lib/banking"
import { redirectToPayfast } from "@/lib/payfast-client"

type PledgeFinancialDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onDone?: () => void
}

type Step = "form" | "details" | "upload" | "done"

// Financial Gift Library pledges are money, so — unlike goods/services
// offerings, which are just a text listing an admin eyeballs — they go
// straight into the same EFT bank-transfer + proof-of-payment flow as a need
// donation. The listing only becomes visible to organizations once an admin
// confirms the payment actually landed.
export function PledgeFinancialDialog({ open, onOpenChange, onDone }: PledgeFinancialDialogProps) {
  const [step, setStep] = useState<Step>("form")
  const [amount, setAmount] = useState("")
  const [purpose, setPurpose] = useState("")
  const [method, setMethod] = useState<"eft" | "payfast">("eft")
  const [bank, setBank] = useState<BankKey>("absa")
  const [donation, setDonation] = useState<{ id: string; amount: number; reference_code: string } | null>(null)
  const [proofFiles, setProofFiles] = useState<File[]>([])
  const [payerNotes, setPayerNotes] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")

  const reset = () => {
    setStep("form")
    setAmount("")
    setPurpose("")
    setMethod("eft")
    setBank("absa")
    setDonation(null)
    setProofFiles([])
    setPayerNotes("")
    setError("")
  }

  const close = () => {
    onOpenChange(false)
    setTimeout(reset, 200)
  }

  const createPledge = async () => {
    const numericAmount = Number(amount)
    if (!numericAmount || numericAmount <= 0) {
      setError("Enter a pledge amount greater than zero.")
      return
    }
    setIsSubmitting(true)
    setError("")
    try {
      const body = method === "eft"
        ? { purpose, amount: numericAmount, payment_method: "eft", bank_name: bank }
        : { purpose, amount: numericAmount, payment_method: "payfast" }
      const res = await fetch("/api/giver/gifts/financial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || "Unable to start this pledge.")
      if (method === "payfast" && data.payfast) {
        redirectToPayfast(data.payfast.action, data.payfast.fields)
        return
      }
      setDonation(data.donation)
      setStep("details")
    } catch (err: any) {
      setError(err.message || "Unable to start this pledge.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const submitProof = async () => {
    if (!donation || proofFiles.length === 0) {
      setError("Attach your proof of payment to continue.")
      return
    }
    setIsSubmitting(true)
    setError("")
    try {
      const formData = new FormData()
      proofFiles.forEach((file) => formData.append("proofs", file))
      formData.append("payer_notes", payerNotes)
      const res = await fetch(`/api/giver/donations/${donation.id}`, { method: "PATCH", body: formData })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || "Unable to submit proof of payment.")
      setStep("done")
      onDone?.()
    } catch (err: any) {
      setError(err.message || "Unable to submit proof of payment.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const account = BANK_ACCOUNTS[bank]

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Banknote className="w-5 h-5 text-purple-600" />
            Pledge Financial Assistance
          </DialogTitle>
        </DialogHeader>

        {error && (
          <div className="rounded-xl bg-red-50 dark:bg-red-950/40 p-3 text-sm font-semibold text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {step === "form" && (
          <div className="space-y-4 pt-1">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              This is a general financial pledge — it will be listed in the Gift Library for a verified organization to claim once your payment is confirmed.
            </p>
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Pledge amount (ZAR)
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">R</span>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="3000.00"
                  className="w-full pl-8 pr-4 py-3 bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#233350] rounded-2xl text-sm font-semibold outline-none focus:border-purple-500 transition-colors"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Purpose (optional)
              </label>
              <textarea
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder="E.g., to support community organizations with urgent needs..."
                className="w-full min-h-20 p-3 bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#233350] rounded-2xl text-sm outline-none focus:border-purple-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Payment method
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setMethod("eft")}
                  className={`rounded-2xl border-2 p-3.5 text-left transition-colors ${
                    method === "eft"
                      ? "border-purple-500 bg-purple-50 dark:bg-purple-950/30"
                      : "border-slate-200 dark:border-[#233350] hover:border-slate-300 dark:hover:border-[#2C3E63]"
                  }`}
                >
                  <Banknote className="w-4 h-4 text-purple-600 mb-1.5" />
                  <p className="text-sm font-bold">Bank Transfer (EFT)</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Manual, verified by admin</p>
                </button>
                <button
                  type="button"
                  onClick={() => setMethod("payfast")}
                  className={`rounded-2xl border-2 p-3.5 text-left transition-colors ${
                    method === "payfast"
                      ? "border-purple-500 bg-purple-50 dark:bg-purple-950/30"
                      : "border-slate-200 dark:border-[#233350] hover:border-slate-300 dark:hover:border-[#2C3E63]"
                  }`}
                >
                  <CreditCard className="w-4 h-4 text-purple-600 mb-1.5" />
                  <p className="text-sm font-bold">PayFast</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Card, Instant EFT & more</p>
                </button>
              </div>
            </div>

            {method === "eft" && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Choose a bank to pay into
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {(Object.keys(BANK_ACCOUNTS) as BankKey[]).map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setBank(key)}
                      className={`rounded-2xl border-2 p-3.5 text-left transition-colors ${
                        bank === key
                          ? "border-purple-500 bg-purple-50 dark:bg-purple-950/30"
                          : "border-slate-200 dark:border-[#233350] hover:border-slate-300 dark:hover:border-[#2C3E63]"
                      }`}
                    >
                      <p className="text-sm font-bold">{BANK_ACCOUNTS[key].bankName}</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{BANK_ACCOUNTS[key].accountType}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <DialogFooter className="pt-2 gap-2">
              <Button type="button" variant="outline" onClick={close}>Cancel</Button>
              <Button type="button" onClick={createPledge} disabled={isSubmitting} className="bg-purple-600 hover:bg-purple-700 text-white">
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                <span>{isSubmitting ? "Preparing..." : method === "eft" ? "Get banking details" : "Continue to PayFast"}</span>
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === "details" && donation && (
          <div className="space-y-4 pt-1">
            <div className="rounded-2xl border border-purple-200 dark:border-purple-900 bg-purple-50 dark:bg-purple-950/30 p-4 space-y-1">
              <p className="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">Amount to transfer</p>
              <p className="text-2xl font-black text-slate-900 dark:text-white">{formatCurrency(donation.amount)}</p>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-[#233350] p-4 space-y-2.5">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{account.bankName}</p>
              <DetailRow label="Account name" value={account.accountName} />
              <DetailRow label="Account number" value={account.accountNumber} mono />
              <DetailRow label="Branch code" value={account.branchCode} mono />
              <DetailRow label="Account type" value={account.accountType} />
              <DetailRow label="SWIFT code" value={account.swiftCode} mono />
              <div className="pt-2 border-t border-slate-100 dark:border-[#233350]">
                <DetailRow label="Payment reference (required)" value={donation.reference_code} mono highlight />
              </div>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Use the reference above so we can match your deposit. Once you've made the transfer, click below to upload your proof of payment.
            </p>

            <DialogFooter className="pt-2 gap-2">
              <Button type="button" variant="outline" onClick={close}>I'll do this later</Button>
              <Button type="button" onClick={() => setStep("upload")} className="bg-purple-600 hover:bg-purple-700 text-white">
                <CheckCircle2 className="w-4 h-4" />
                <span>I've made the payment</span>
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === "upload" && donation && (
          <div className="space-y-4 pt-1">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Upload your proof of payment (bank receipt, screenshot, or statement) for reference <span className="font-mono font-bold">{donation.reference_code}</span>.
            </p>
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Proof of payment</label>
              <label className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 dark:border-[#233350] p-6 text-center cursor-pointer hover:border-purple-400 transition-colors">
                <UploadCloud className="w-6 h-6 text-slate-400" />
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {proofFiles.length === 0
                    ? "Click to select file(s) — image or PDF"
                    : proofFiles.length === 1
                    ? proofFiles[0].name
                    : `${proofFiles.length} files selected`}
                </span>
                <input
                  type="file"
                  multiple
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={(e) => setProofFiles(Array.from(e.target.files || []))}
                />
              </label>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Notes (optional)</label>
              <textarea
                value={payerNotes}
                onChange={(e) => setPayerNotes(e.target.value)}
                placeholder="E.g., paid from a joint account, or any detail that may help verification..."
                className="w-full min-h-20 p-3 bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#233350] rounded-2xl text-sm outline-none focus:border-purple-500"
              />
            </div>
            <DialogFooter className="pt-2 gap-2">
              <Button type="button" variant="outline" onClick={() => setStep("details")}>Back</Button>
              <Button type="button" onClick={submitProof} disabled={isSubmitting} className="bg-purple-600 hover:bg-purple-700 text-white">
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
                <span>{isSubmitting ? "Submitting..." : "Submit for verification"}</span>
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === "done" && (
          <div className="py-6 text-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 flex items-center justify-center mx-auto text-amber-600 dark:text-amber-400">
              <Clock className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold">Pending verification</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              Thank you! Your proof of payment has been submitted. Once an administrator confirms it, your pledge will appear in the Gift Library for organizations to claim.
            </p>
            <Button type="button" onClick={close} className="bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 mt-2">
              Close
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function DetailRow({ label, value, mono, highlight }: { label: string; value: string; mono?: boolean; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-slate-500 dark:text-slate-400">{label}</span>
      <span className={`text-sm font-bold text-right ${mono ? "font-mono" : ""} ${highlight ? "text-purple-600 dark:text-purple-400" : ""}`}>
        {value}
      </span>
    </div>
  )
}
