"use client"

import { useEffect, useState } from "react"
import { Banknote, CheckCircle2, Clock, Eye, FileText, Loader2, Mail, ThumbsDown, ThumbsUp, Trash2, UploadCloud, XCircle } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { formatCurrency } from "@/lib/banking"
import { useBankAccounts } from "@/lib/use-bank-accounts"
import { MessageComposeDialog } from "@/components/message-compose-dialog"
import { MicButton } from "@/components/mic-button"
import { GrammarCheckButton } from "@/components/grammar-check-button"
import { appendSpeech } from "@/lib/speech-to-text"
import { showFeedback } from "@/lib/inline-feedback"

export type DonationSummary = {
  id: string
  amount: number
  payment_method: string
  status: "pending" | "successful" | "unsuccessful"
  reference_code: string
  bank_name?: string | null
  proof_storage_path?: string | null
  payer_notes?: string | null
  admin_notes?: string | null
  receipt_sent_at?: string | null
  created_at: string
  needTitle: string
  orgName?: string | null
  giverName?: string | null
  giverEmail?: string | null
  giverProfileId?: string | null
  is_platform_donation?: boolean
  need_id?: string | null
  gift_offering_id?: string | null
}

type Role = "giver" | "organization" | "admin"

type DonationDetailDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  donation: DonationSummary | null
  role: Role
  onChanged?: () => void
  /** Retrying an unsuccessful donation - the caller decides which creation
   * dialog to reopen and with what prefilled. Omit to hide the button
   * entirely (e.g. on the admin/organization read-only views). */
  onRetry?: (donation: DonationSummary) => void
}

export function statusBadgeClasses(status: string) {
  if (status === "successful") return "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
  if (status === "unsuccessful") return "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300"
  return "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300"
}

export function DonationDetailDialog({ open, onOpenChange, donation, role, onChanged, onRetry }: DonationDetailDialogProps) {
  const [proofSignedUrl, setProofSignedUrl] = useState<string | null>(null)
  const [proofs, setProofs] = useState<{ id: string; file_name: string | null; url: string | null }[]>([])
  const [isLoadingProof, setIsLoadingProof] = useState(false)
  const [proofFiles, setProofFiles] = useState<File[]>([])
  const [payerNotes, setPayerNotes] = useState("")
  const [isUploading, setIsUploading] = useState(false)
  const [removingProofId, setRemovingProofId] = useState<string | null>(null)
  const [isCancellingPayment, setIsCancellingPayment] = useState(false)
  const [isReviewing, setIsReviewing] = useState(false)
  const [rejectNotes, setRejectNotes] = useState("")
  const [showRejectForm, setShowRejectForm] = useState(false)
  const [error, setError] = useState("")
  const [reviewAmount, setReviewAmount] = useState("")
  const [isSendingReceipt, setIsSendingReceipt] = useState(false)
  const [receiptSentAt, setReceiptSentAt] = useState<string | null | undefined>(donation?.receipt_sent_at)
  const [receiptSentConfirmation, setReceiptSentConfirmation] = useState("")
  const [isThankingDonor, setIsThankingDonor] = useState(false)

  const fetchBase = role === "admin" ? "/api/admin/donations" : "/api/giver/donations"
  const { accounts: bankAccounts } = useBankAccounts()

  const refreshProofs = (donationId: string) => {
    setIsLoadingProof(true)
    return fetch(`${fetchBase}/${donationId}`)
      .then((res) => res.json())
      .then((data) => {
        setProofSignedUrl(data.proofSignedUrl || null)
        setProofs(data.proofs || [])
      })
      .catch(() => {})
      .finally(() => setIsLoadingProof(false))
  }

  useEffect(() => {
    setProofSignedUrl(null)
    setProofs([])
    setProofFiles([])
    setPayerNotes("")
    setShowRejectForm(false)
    setRejectNotes("")
    setError("")
    setReviewAmount(donation ? String(donation.amount) : "")
    setReceiptSentAt(donation?.receipt_sent_at)
    setReceiptSentConfirmation("")
    setIsThankingDonor(false)
    if (!donation || !donation.proof_storage_path) return
    // An organization normally has no business seeing a donor's proof of
    // payment - except when it IS the donor, on its own "Support The
    // Platform" donation, which is the same isOwnPayer case the rest of
    // this dialog already special-cases.
    const isOwnPayerNow = role === "giver" || (role === "organization" && !!donation.is_platform_donation)
    if (role === "organization" && !isOwnPayerNow) return
    refreshProofs(donation.id)
  }, [donation, role])

  if (!donation) return null

  const bankAccount = donation.bank_name ? bankAccounts.find(a => a.key === donation.bank_name) || null : null
  const isAutoConfirmMethod = donation.payment_method === "payfast" || donation.payment_method === "paypal"
  const awaitingProof = donation.status === "pending" && !donation.proof_storage_path && !isAutoConfirmMethod
  const awaitingAutoConfirm = donation.status === "pending" && isAutoConfirmMethod
  // A giver always paid their own donation. An organization only ever pays
  // for one itself when it's a "Support The Platform" donation - every
  // other donation an org sees is one it received (read-only for them).
  const isOwnPayer = role === "giver" || (role === "organization" && !!donation.is_platform_donation)
  // Proof already exists and admin hasn't reviewed it yet - the payer can
  // still fix a wrong upload, drop a duplicate, or add more, right up until
  // it's actually reviewed.
  const canManageProof = isOwnPayer && donation.status === "pending" && !!donation.proof_storage_path && !isAutoConfirmMethod

  const uploadProof = async () => {
    if (proofFiles.length === 0) {
      setError("Attach your proof of payment to continue.")
      return
    }
    setIsUploading(true)
    setError("")
    try {
      const formData = new FormData()
      proofFiles.forEach((file) => formData.append("proofs", file))
      formData.append("payer_notes", payerNotes)
      const res = await fetch(`/api/giver/donations/${donation.id}`, { method: "PATCH", body: formData })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || "Unable to submit proof of payment.")
      setProofFiles([])
      await refreshProofs(donation.id)
      showFeedback(awaitingProof ? "Proof of payment submitted for verification." : "Proof of payment added.")
      onChanged?.()
    } catch (err: any) {
      setError(err.message || "Unable to submit proof of payment.")
    } finally {
      setIsUploading(false)
    }
  }

  const removeProof = async (proofId: string) => {
    setRemovingProofId(proofId)
    setError("")
    try {
      const res = await fetch(`/api/giver/donations/${donation.id}/proof/${proofId}`, { method: "DELETE" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || "Could not remove this proof file.")
      await refreshProofs(donation.id)
      showFeedback("Proof file removed.")
      onChanged?.()
    } catch (err: any) {
      setError(err.message || "Could not remove this proof file.")
    } finally {
      setRemovingProofId(null)
    }
  }

  const cancelPendingPayment = async () => {
    setIsCancellingPayment(true)
    setError("")
    try {
      const res = await fetch(`/api/giver/donations/${donation.id}/cancel`, { method: "POST" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || "Could not cancel this payment.")
      showFeedback("Payment attempt cancelled.")
      onChanged?.()
    } catch (err: any) {
      setError(err.message || "Could not cancel this payment.")
    } finally {
      setIsCancellingPayment(false)
    }
  }

  const review = async (status: "successful" | "unsuccessful") => {
    const numericAmount = Number(reviewAmount)
    if (!numericAmount || numericAmount <= 0) {
      setError("Enter a valid amount greater than zero.")
      return
    }
    setIsReviewing(true)
    setError("")
    try {
      const res = await fetch(`/api/admin/donations/${donation.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, admin_notes: status === "unsuccessful" ? rejectNotes : "", amount: numericAmount }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || "Unable to update this donation.")
      showFeedback(status === "successful" ? "Donation approved." : "Donation marked unsuccessful.")
      onChanged?.()
      onOpenChange(false)
    } catch (err: any) {
      setError(err.message || "Unable to update this donation.")
    } finally {
      setIsReviewing(false)
    }
  }

  const sendReceipt = async () => {
    setIsSendingReceipt(true)
    setError("")
    setReceiptSentConfirmation("")
    try {
      const res = await fetch(`/api/admin/donations/${donation.id}/receipt`, { method: "POST" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || "Unable to send the receipt.")
      setReceiptSentAt(data.receipt_sent_at)
      setReceiptSentConfirmation(donation.giverEmail ? `Receipt sent to ${donation.giverEmail}.` : "Receipt sent.")
    } catch (err: any) {
      setError(err.message || "Unable to send the receipt.")
    } finally {
      setIsSendingReceipt(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Banknote className="w-5 h-5 text-blue-600" />
            Donation Details
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {error && (
            <div className="rounded-xl bg-red-50 dark:bg-red-950/40 p-3 text-sm font-semibold text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          <div className="rounded-2xl border border-slate-200 dark:border-[#233350] p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base">{donation.needTitle}</h3>
              <span className={`rounded-full px-3 py-1 text-xs font-bold capitalize ${statusBadgeClasses(donation.status)}`}>
                {donation.status === "pending" ? (donation.proof_storage_path ? "Pending Verification" : "Awaiting Payment") : donation.status}
              </span>
            </div>
            {(donation.orgName || donation.giverName) && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {donation.orgName && <>Organization: <span className="font-semibold">{donation.orgName}</span></>}
                {donation.orgName && donation.giverName && " · "}
                {donation.giverName && <>Donor: <span className="font-semibold">{donation.giverName}</span> ({donation.giverEmail})</>}
              </p>
            )}
            <div className="grid grid-cols-2 gap-3 pt-1 text-sm">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Amount</p>
                <p className="font-bold text-lg">{formatCurrency(Number(donation.amount))}</p>
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Reference</p>
                <p className="font-mono font-bold">{donation.reference_code}</p>
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Method</p>
                <p className="font-semibold uppercase">{donation.payment_method}</p>
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Submitted</p>
                <p className="font-semibold">{new Date(donation.created_at).toLocaleDateString()}</p>
              </div>
            </div>
          </div>

          {bankAccount && (
            <div className="rounded-2xl border border-slate-200 dark:border-[#233350] p-4 space-y-1.5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{bankAccount.bankName}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Acc: {bankAccount.accountName} · {bankAccount.accountNumber} · Branch {bankAccount.branchCode}</p>
            </div>
          )}

          {donation.payer_notes && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Donor notes</p>
              <p className="text-sm text-slate-600 dark:text-slate-300">{donation.payer_notes}</p>
            </div>
          )}

          {/* admin_notes doubles as two different things: a rejection reason an
              admin deliberately wrote to be "shared with the donor" (see the
              reject form below), and, on an auto-confirmed PayFast/PayPal
              donation, an internal system note ("Auto-confirmed via
              PayPal...") that was never meant for the donor to see. Only the
              first case is ever true outside admin - a rejection - so that's
              the only time it's shown to a giver or organization; admin
              always sees it, for either reason. */}
          {donation.admin_notes && (role === "admin" || donation.status === "unsuccessful") && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Admin notes</p>
              <p className="text-sm text-slate-600 dark:text-slate-300">{donation.admin_notes}</p>
            </div>
          )}

          {(role !== "organization" || isOwnPayer) && donation.proof_storage_path && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Proof of payment{proofs.length > 1 ? ` (${proofs.length} files)` : ""}
              </p>
              {isLoadingProof ? (
                <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
              ) : proofs.length > 0 ? (
                <div className="grid grid-cols-2 gap-2">
                  {proofs.map((proof) => (
                    <div key={proof.id} className="relative">
                      <a href={proof.url || "#"} target="_blank" rel="noreferrer" className="block">
                        {proof.url && /\.pdf($|\?)/i.test(proof.url) ? (
                          <span className="flex h-24 items-center justify-center rounded-xl border border-slate-200 dark:border-[#233350] text-xs font-bold text-blue-600 hover:underline text-center px-2">📄 {proof.file_name || "View PDF"}</span>
                        ) : (
                          <img src={proof.url || undefined} alt={proof.file_name || "Proof of payment"} className="rounded-xl h-24 w-full object-cover border border-slate-200 dark:border-[#233350]" />
                        )}
                      </a>
                      {canManageProof && (
                        <button
                          type="button"
                          data-tip="Remove this proof file"
                          onClick={() => removeProof(proof.id)}
                          disabled={removingProofId === proof.id}
                          className="absolute top-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white hover:bg-red-600 transition-colors disabled:opacity-50"
                        >
                          {removingProofId === proof.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : proofSignedUrl ? (
                <a href={proofSignedUrl} target="_blank" rel="noreferrer" className="block">
                  {/\.pdf($|\?)/i.test(proofSignedUrl) ? (
                    <span className="inline-flex items-center gap-2 text-xs font-bold text-blue-600 hover:underline">📄 View uploaded PDF</span>
                  ) : (
                    <img src={proofSignedUrl} alt="Proof of payment" className="rounded-xl max-h-64 w-full object-cover border border-slate-200 dark:border-[#233350]" />
                  )}
                </a>
              ) : (
                <p className="text-xs text-slate-400">Unable to load proof file.</p>
              )}
            </div>
          )}

          {/* Whoever actually paid - a giver, or an organization on its own
              "Support The Platform" donation - can upload proof for the
              first time, or add to / replace what's there while this
              donation still sits with admin for review. */}
          {isOwnPayer && (awaitingProof || canManageProof) && (
            <div className="space-y-3 rounded-2xl border-2 border-dashed border-blue-200 dark:border-blue-900 p-4">
              <p className="text-xs font-semibold text-blue-700 dark:text-blue-300">
                {awaitingProof
                  ? "Made the transfer? Upload your proof of payment to send this for verification."
                  : "Still awaiting review - remove a file above, or add more proof of payment below."}
              </p>
              <label className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 dark:border-[#233350] p-5 text-center cursor-pointer hover:border-blue-400 transition-colors">
                <UploadCloud className="w-5 h-5 text-slate-400" />
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {proofFiles.length === 0
                    ? "Click to select file(s) - image or PDF"
                    : proofFiles.length === 1
                    ? proofFiles[0].name
                    : `${proofFiles.length} files selected`}
                </span>
                <input type="file" multiple accept="image/*,application/pdf" className="hidden" onChange={(e) => setProofFiles(Array.from(e.target.files || []))} />
              </label>
              <div className="flex justify-end mb-1">
                <GrammarCheckButton text={payerNotes} onTextChange={setPayerNotes} />
              </div>
              <div className="relative">
                <textarea
                  value={payerNotes}
                  onChange={(e) => setPayerNotes(e.target.value)}
                  placeholder="Notes (optional)"
                  className="w-full min-h-16 p-3 pr-11 bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#233350] rounded-2xl text-sm outline-none focus:border-blue-500"
                />
                <MicButton className="top-2 right-2" onText={text => setPayerNotes(n => appendSpeech(n, text))} />
              </div>
              <Button type="button" onClick={uploadProof} disabled={isUploading} className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
                <span>{isUploading ? "Submitting..." : awaitingProof ? "Submit for verification" : "Add file(s)"}</span>
              </Button>
            </div>
          )}

          {/* Whoever paid: PayFast/PayPal checkout never completed - their
              own success/failure confirmation never fires if the checkout
              was cancelled, failed, or abandoned, so without this it would
              sit as "pending" forever. */}
          {isOwnPayer && awaitingAutoConfirm && (
            <div className="space-y-2 rounded-2xl border-2 border-dashed border-amber-200 dark:border-amber-900 p-4">
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                This {donation.payment_method === "paypal" ? "PayPal" : "PayFast"} payment hasn't been completed. If the checkout didn't go through, cancel this attempt and try again.
              </p>
              <Button type="button" variant="outline" onClick={cancelPendingPayment} disabled={isCancellingPayment} className="w-full">
                {isCancellingPayment ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                <span>{isCancellingPayment ? "Cancelling..." : "Cancel this payment attempt"}</span>
              </Button>
            </div>
          )}

          {/* Admin: EFT needs a human to check the uploaded proof, so approve/reject
              with an editable confirmed amount makes sense there. PayFast/PayPal
              self-confirm via their own webhook the moment a payment actually
              succeeds - a donation still pending under one of those methods means
              it failed, was cancelled, or was abandoned before checkout completed,
              never something with evidence for an admin to verify. */}
          {role === "admin" && donation.status === "pending" && isAutoConfirmMethod && (
            <div className="space-y-3 rounded-2xl border-2 border-dashed border-amber-200 dark:border-amber-900 p-4">
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                This {donation.payment_method === "paypal" ? "PayPal" : "PayFast"} payment never confirmed - {donation.payment_method === "paypal" ? "PayPal" : "PayFast"} notifies HelpLift automatically the moment a payment actually succeeds, so this means it failed, was cancelled, or was abandoned before checkout completed. There's nothing to verify here, only whether to close it out.
              </p>
              <Button type="button" onClick={() => review("unsuccessful")} disabled={isReviewing} className="w-full bg-red-600 hover:bg-red-700 text-white">
                {isReviewing ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                <span>{isReviewing ? "Marking..." : "Mark as unsuccessful"}</span>
              </Button>
            </div>
          )}

          {role === "admin" && donation.status === "pending" && !isAutoConfirmMethod && (
            <div className="space-y-3 pt-1">
              <div className="space-y-1.5 rounded-2xl border border-slate-200 dark:border-[#233350] p-3">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Confirmed amount (edit if the proof of payment shows a different value)
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">R</span>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={reviewAmount}
                    onChange={(e) => setReviewAmount(e.target.value)}
                    className="w-full pl-8 pr-4 py-2.5 bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#233350] rounded-xl text-sm font-semibold outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>
              {showRejectForm && (
                <div>
                  <div className="flex justify-end mb-1">
                    <GrammarCheckButton text={rejectNotes} onTextChange={setRejectNotes} />
                  </div>
                  <div className="relative">
                  <textarea
                    value={rejectNotes}
                    onChange={(e) => setRejectNotes(e.target.value)}
                    placeholder="Reason for rejection (optional, shared with the donor)..."
                    className="w-full min-h-16 p-3 pr-11 bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#233350] rounded-2xl text-sm outline-none focus:border-red-500"
                  />
                  <MicButton className="top-2 right-2" onText={text => setRejectNotes(n => appendSpeech(n, text))} />
                  </div>
                </div>
              )}
              <DialogFooter className="gap-2">
                {!showRejectForm ? (
                  <>
                    <Button type="button" variant="outline" onClick={() => setShowRejectForm(true)} disabled={isReviewing} className="text-red-600 border-red-200 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/30">
                      <ThumbsDown className="w-4 h-4" /> Reject
                    </Button>
                    <Button type="button" onClick={() => review("successful")} disabled={isReviewing} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                      {isReviewing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ThumbsUp className="w-4 h-4" />}
                      <span>Approve</span>
                    </Button>
                  </>
                ) : (
                  // Once "Reject" has been clicked, "Approve" is deliberately not
                  // rendered at all - having both a step-1 "Reject" and a live
                  // "Approve" on screen together let a stray or mistimed click
                  // approve a donation the admin was in the middle of rejecting.
                  // "Cancel" is the only way back to the normal approve/reject choice.
                  <>
                    <Button type="button" variant="outline" onClick={() => { setShowRejectForm(false); setRejectNotes("") }} disabled={isReviewing}>
                      Cancel
                    </Button>
                    <Button type="button" onClick={() => review("unsuccessful")} disabled={isReviewing} className="bg-red-600 hover:bg-red-700 text-white">
                      {isReviewing ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                      <span>Confirm rejection</span>
                    </Button>
                  </>
                )}
              </DialogFooter>
            </div>
          )}

          {donation.status !== "pending" && (
            <div className={`flex items-center gap-2 rounded-xl p-3 text-sm font-semibold ${statusBadgeClasses(donation.status)}`}>
              {donation.status === "successful" ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <XCircle className="w-4 h-4 shrink-0" />}
              This donation has been {donation.status === "successful" ? "confirmed as successful" : "marked unsuccessful"}.
            </div>
          )}

          {/* Only whoever actually paid can retry - never the organization
              receiving a donation, and never admin, who has no stake in
              re-attempting someone else's payment. */}
          {isOwnPayer && donation.status === "unsuccessful" && onRetry && (
            <Button
              type="button"
              onClick={() => onRetry(donation)}
              data-tip="Opens the same form again with the amount and payment method already filled in"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Banknote className="w-4 h-4" />
              <span>Retry this donation</span>
            </Button>
          )}

          {role === "admin" && donation.status === "successful" && (
            <div className="space-y-2">
              <div className="flex gap-2">
                <Button type="button" variant="outline" asChild className="flex-1">
                  <a href={`/api/admin/donations/${donation.id}/receipt`} target="_blank" rel="noreferrer">
                    <Eye className="w-4 h-4" /> Preview receipt
                  </a>
                </Button>
                <Button type="button" variant="outline" onClick={sendReceipt} disabled={isSendingReceipt} className="flex-1">
                  {isSendingReceipt ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                  <span>{isSendingReceipt ? "Sending..." : receiptSentAt ? "Resend" : "Send to donor"}</span>
                </Button>
              </div>
              {receiptSentConfirmation && (
                <p role="status" className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" /> {receiptSentConfirmation}
                </p>
              )}
              {receiptSentAt && (
                <p className="flex items-center gap-1.5 text-xs text-slate-400">
                  <Mail className="w-3.5 h-3.5" /> Receipt last sent {new Date(receiptSentAt).toLocaleString()}
                </p>
              )}
            </div>
          )}

          {role === "organization" && donation.status === "successful" && donation.giverProfileId && (
            <Button type="button" variant="outline" onClick={() => setIsThankingDonor(true)} className="w-full">
              <Mail className="w-4 h-4" /> Thank the donor
            </Button>
          )}

          {isOwnPayer && donation.status === "pending" && donation.proof_storage_path && (
            <div className="flex items-center gap-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 p-3 text-sm font-semibold text-amber-700 dark:text-amber-300">
              <Clock className="w-4 h-4 shrink-0" />
              Awaiting admin verification.
            </div>
          )}
        </div>
      </DialogContent>

      {role === "organization" && donation.giverProfileId && (
        <MessageComposeDialog
          open={isThankingDonor}
          onOpenChange={setIsThankingDonor}
          recipientLabel={donation.giverName || "Donor"}
          recipientId={donation.giverProfileId}
          defaultMessage={`Thank you so much for your donation of ${formatCurrency(Number(donation.amount))} towards "${donation.needTitle}"! We've received it and really appreciate your support.`}
        />
      )}
    </Dialog>
  )
}
