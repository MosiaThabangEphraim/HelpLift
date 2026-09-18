"use client"

import { useEffect, useState } from "react"
import { Banknote, CheckCircle2, Clock, Eye, FileText, Loader2, Mail, ThumbsDown, ThumbsUp, UploadCloud, XCircle } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { BANK_ACCOUNTS, formatCurrency, type BankKey } from "@/lib/banking"
import { MessageComposeDialog } from "@/components/message-compose-dialog"

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
}

type Role = "giver" | "organization" | "admin"

type DonationDetailDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  donation: DonationSummary | null
  role: Role
  onChanged?: () => void
}

export function statusBadgeClasses(status: string) {
  if (status === "successful") return "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
  if (status === "unsuccessful") return "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300"
  return "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300"
}

export function DonationDetailDialog({ open, onOpenChange, donation, role, onChanged }: DonationDetailDialogProps) {
  const [proofSignedUrl, setProofSignedUrl] = useState<string | null>(null)
  const [proofs, setProofs] = useState<{ id: string; file_name: string | null; url: string | null }[]>([])
  const [isLoadingProof, setIsLoadingProof] = useState(false)
  const [proofFiles, setProofFiles] = useState<File[]>([])
  const [payerNotes, setPayerNotes] = useState("")
  const [isUploading, setIsUploading] = useState(false)
  const [isReviewing, setIsReviewing] = useState(false)
  const [rejectNotes, setRejectNotes] = useState("")
  const [showRejectForm, setShowRejectForm] = useState(false)
  const [error, setError] = useState("")
  const [reviewAmount, setReviewAmount] = useState("")
  const [isSendingReceipt, setIsSendingReceipt] = useState(false)
  const [receiptSentAt, setReceiptSentAt] = useState<string | null | undefined>(donation?.receipt_sent_at)
  const [isThankingDonor, setIsThankingDonor] = useState(false)

  const fetchBase = role === "admin" ? "/api/admin/donations" : "/api/giver/donations"

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
    setIsThankingDonor(false)
    if (!donation || !donation.proof_storage_path || role === "organization") return
    setIsLoadingProof(true)
    fetch(`${fetchBase}/${donation.id}`)
      .then((res) => res.json())
      .then((data) => {
        setProofSignedUrl(data.proofSignedUrl || null)
        setProofs(data.proofs || [])
      })
      .catch(() => {})
      .finally(() => setIsLoadingProof(false))
  }, [donation, role])

  if (!donation) return null

  const bankAccount = donation.bank_name && donation.bank_name in BANK_ACCOUNTS ? BANK_ACCOUNTS[donation.bank_name as BankKey] : null
  const awaitingProof = donation.status === "pending" && !donation.proof_storage_path

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
      onChanged?.()
    } catch (err: any) {
      setError(err.message || "Unable to submit proof of payment.")
    } finally {
      setIsUploading(false)
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
    try {
      const res = await fetch(`/api/admin/donations/${donation.id}/receipt`, { method: "POST" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || "Unable to send the receipt.")
      setReceiptSentAt(data.receipt_sent_at)
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

          {donation.admin_notes && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Admin notes</p>
              <p className="text-sm text-slate-600 dark:text-slate-300">{donation.admin_notes}</p>
            </div>
          )}

          {role !== "organization" && donation.proof_storage_path && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Proof of payment{proofs.length > 1 ? ` (${proofs.length} files)` : ""}
              </p>
              {isLoadingProof ? (
                <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
              ) : proofs.length > 0 ? (
                <div className="grid grid-cols-2 gap-2">
                  {proofs.map((proof) => (
                    <a key={proof.id} href={proof.url || "#"} target="_blank" rel="noreferrer" className="block">
                      {proof.url && /\.pdf($|\?)/i.test(proof.url) ? (
                        <span className="flex h-24 items-center justify-center rounded-xl border border-slate-200 dark:border-[#233350] text-xs font-bold text-blue-600 hover:underline text-center px-2">📄 {proof.file_name || "View PDF"}</span>
                      ) : (
                        <img src={proof.url || undefined} alt={proof.file_name || "Proof of payment"} className="rounded-xl h-24 w-full object-cover border border-slate-200 dark:border-[#233350]" />
                      )}
                    </a>
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

          {/* Giver: still needs to upload proof */}
          {role === "giver" && awaitingProof && (
            <div className="space-y-3 rounded-2xl border-2 border-dashed border-blue-200 dark:border-blue-900 p-4">
              <p className="text-xs font-semibold text-blue-700 dark:text-blue-300">Made the transfer? Upload your proof of payment to send this for verification.</p>
              <label className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 dark:border-[#233350] p-5 text-center cursor-pointer hover:border-blue-400 transition-colors">
                <UploadCloud className="w-5 h-5 text-slate-400" />
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {proofFiles.length === 0
                    ? "Click to select file(s) — image or PDF"
                    : proofFiles.length === 1
                    ? proofFiles[0].name
                    : `${proofFiles.length} files selected`}
                </span>
                <input type="file" multiple accept="image/*,application/pdf" className="hidden" onChange={(e) => setProofFiles(Array.from(e.target.files || []))} />
              </label>
              <textarea
                value={payerNotes}
                onChange={(e) => setPayerNotes(e.target.value)}
                placeholder="Notes (optional)"
                className="w-full min-h-16 p-3 bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#233350] rounded-2xl text-sm outline-none focus:border-blue-500"
              />
              <Button type="button" onClick={uploadProof} disabled={isUploading} className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
                <span>{isUploading ? "Submitting..." : "Submit for verification"}</span>
              </Button>
            </div>
          )}

          {/* Admin: approve / reject */}
          {role === "admin" && donation.status === "pending" && (
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
                <textarea
                  value={rejectNotes}
                  onChange={(e) => setRejectNotes(e.target.value)}
                  placeholder="Reason for rejection (optional, shared with the donor)..."
                  className="w-full min-h-16 p-3 bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#233350] rounded-2xl text-sm outline-none focus:border-red-500"
                />
              )}
              <DialogFooter className="gap-2">
                {!showRejectForm ? (
                  <Button type="button" variant="outline" onClick={() => setShowRejectForm(true)} className="text-red-600 border-red-200 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/30">
                    <ThumbsDown className="w-4 h-4" /> Reject
                  </Button>
                ) : (
                  <Button type="button" variant="outline" onClick={() => review("unsuccessful")} disabled={isReviewing} className="text-red-600 border-red-200 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/30">
                    {isReviewing ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                    <span>Confirm rejection</span>
                  </Button>
                )}
                <Button type="button" onClick={() => review("successful")} disabled={isReviewing} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  {isReviewing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ThumbsUp className="w-4 h-4" />}
                  <span>Approve</span>
                </Button>
              </DialogFooter>
            </div>
          )}

          {donation.status !== "pending" && (
            <div className={`flex items-center gap-2 rounded-xl p-3 text-sm font-semibold ${statusBadgeClasses(donation.status)}`}>
              {donation.status === "successful" ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <XCircle className="w-4 h-4 shrink-0" />}
              This donation has been {donation.status === "successful" ? "confirmed as successful" : "marked unsuccessful"}.
            </div>
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

          {role === "giver" && donation.status === "pending" && donation.proof_storage_path && (
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
