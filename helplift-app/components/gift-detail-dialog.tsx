"use client"

import { useEffect, useState } from "react"
import { AdminDeleteButton } from "@/components/admin-delete-button"
import { stageFormFiles } from "@/lib/stage-uploads"
import { describeUploadLimit, UPLOAD_LIMITS } from "@/lib/upload-limits"
import { FileText, Gift, Loader2, MapPin, Calendar, ThumbsDown, ThumbsUp, UploadCloud, X, XCircle } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { formatCurrency } from "@/lib/banking"
import { MicButton } from "@/components/mic-button"
import { GrammarCheckButton } from "@/components/grammar-check-button"
import { appendSpeech } from "@/lib/speech-to-text"

export type GiftClaimSummary = {
  id: string
  organization_id: string
  organization_name: string
  motivation: string
  status: "pending" | "approved" | "rejected"
  claim_notes?: string | null
  created_at: string
  documents: { id: string; file_name: string | null; url: string | null }[]
}

export type GiftDetailSummary = {
  id: string
  title: string
  offering_type: string
  description: string
  quantity_or_value?: string | null
  conditions?: string | null
  location?: string | null
  expiry_date?: string | null
  status: string
  rejection_reason?: string | null
  created_at: string
  giverName?: string | null
  giverEmail?: string | null
  claimedByOrgName?: string | null
  /** Admin view: every claim ever made on this offering, pending first. */
  claims?: GiftClaimSummary[]
  /** Organization view: does my own org already have a claim awaiting a decision on this offering? */
  myClaimPending?: boolean
  /** Optional photos the giver attached when pledging a goods/services offering. */
  photos?: { id: string; file_name: string | null; url: string | null }[]
}

type Role = "admin" | "organization" | "giver"

export function statusPillClasses(status: string) {
  if (status === "approved") return "bg-emerald-50 text-emerald-700"
  if (status === "claimed") return "bg-blue-50 text-blue-700"
  if (status === "rejected") return "bg-red-50 text-red-700"
  return "bg-slate-100 dark:bg-[#1A2740] text-slate-700 dark:text-slate-300"
}

function claimStatusPillClasses(status: string) {
  if (status === "approved") return "bg-emerald-50 text-emerald-700"
  if (status === "rejected") return "bg-red-50 text-red-700"
  return "bg-amber-50 text-amber-700"
}

type GiftDetailDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  gift: GiftDetailSummary | null
  role: Role
  canClaim?: boolean
  onModerate?: (status: "approved" | "rejected") => Promise<void> | void
  /** Approves or declines one specific claim - an offering can have several at once. */
  onClaimReview?: (claimId: string, approve: boolean, notes?: string) => Promise<void> | void
  /** Housekeeping - deletes one already-decided (approved/rejected) claim record. */
  onClaimDelete?: (claimId: string) => Promise<void> | void
  onClaim?: (motivation: string, documents: File[]) => Promise<void> | void
}

export function GiftDetailDialog({ open, onOpenChange, gift, role, canClaim, onModerate, onClaimReview, onClaimDelete, onClaim }: GiftDetailDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showRejectForm, setShowRejectForm] = useState(false)
  const [rejectNotes, setRejectNotes] = useState("")
  const [reviewingClaimId, setReviewingClaimId] = useState<string | null>(null)
  const [claimReasonById, setClaimReasonById] = useState<Record<string, string>>({})
  const [deletingClaimId, setDeletingClaimId] = useState<string | null>(null)
  const [showClaimForm, setShowClaimForm] = useState(false)
  const [motivation, setMotivation] = useState("")
  const [claimDocuments, setClaimDocuments] = useState<File[]>([])
  const [error, setError] = useState("")

  useEffect(() => {
    setShowRejectForm(false)
    setRejectNotes("")
    setReviewingClaimId(null)
    setClaimReasonById({})
    setShowClaimForm(false)
    setMotivation("")
    setClaimDocuments([])
    setError("")
  }, [gift])

  if (!gift) return null

  const isFinancial = gift.offering_type === "financial"
  const pendingClaims = (gift.claims || []).filter(c => c.status === "pending")
  const decidedClaims = (gift.claims || []).filter(c => c.status !== "pending")

  const run = async (fn?: () => Promise<void> | void, closeOnSuccess = true) => {
    if (!fn) return
    setIsSubmitting(true)
    setError("")
    try {
      await fn()
      if (closeOnSuccess) onOpenChange(false)
    } catch (err: any) {
      setError(err?.message || "Something went wrong.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const reviewClaim = async (claimId: string, approve: boolean) => {
    if (!onClaimReview) return
    setIsSubmitting(true)
    setError("")
    try {
      await onClaimReview(claimId, approve, claimReasonById[claimId])
      setReviewingClaimId(null)
      // Approving closes the dialog (the offering is now claimed and gone
      // from the pool); declining one claim leaves the others open to review.
      if (approve) onOpenChange(false)
    } catch (err: any) {
      setError(err?.message || "Something went wrong.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const deleteClaim = async (claimId: string) => {
    if (!onClaimDelete) return
    setDeletingClaimId(claimId)
    setError("")
    try {
      await onClaimDelete(claimId)
    } catch (err: any) {
      setError(err?.message || "Something went wrong.")
    } finally {
      setDeletingClaimId(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gift className="w-5 h-5 text-purple-600" />
            {gift.title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {error && (
            <div className="rounded bg-red-50 dark:bg-red-950/40 p-3 text-sm font-semibold text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-bold px-2.5 py-1 rounded bg-purple-50 text-purple-700 capitalize">{gift.offering_type}</span>
            <span className={`text-[11px] font-bold px-2.5 py-1 rounded capitalize ${statusPillClasses(gift.status)}`}>{gift.status}</span>
            {role === "admin" && pendingClaims.length > 0 && (
              <span className="text-[11px] font-bold px-2.5 py-1 rounded bg-amber-50 text-amber-700">
                {pendingClaims.length} pending claim{pendingClaims.length === 1 ? "" : "s"}
              </span>
            )}
          </div>

          <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-line">{gift.description}</p>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{isFinancial ? "Amount" : "Quantity / Value"}</p>
              <p className="font-bold">{isFinancial && gift.quantity_or_value ? formatCurrency(Number(gift.quantity_or_value)) : (gift.quantity_or_value || "-")}</p>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Pledged</p>
              <p className="font-semibold">{new Date(gift.created_at).toLocaleDateString()}</p>
            </div>
            {gift.location && (
              <div className="col-span-2 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                <MapPin className="w-3.5 h-3.5" /> {gift.location}
              </div>
            )}
            {gift.expiry_date && (
              <div className="col-span-2 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                <Calendar className="w-3.5 h-3.5" /> Valid until {gift.expiry_date}
              </div>
            )}
          </div>

          {gift.conditions && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Conditions</p>
              <p className="text-sm text-slate-600 dark:text-slate-300">{gift.conditions}</p>
            </div>
          )}

          {gift.photos && gift.photos.length > 0 && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Photos</p>
              <div className="grid grid-cols-3 gap-2">
                {gift.photos.map(photo => (
                  <a
                    key={photo.id}
                    href={photo.url || undefined}
                    target="_blank"
                    rel="noreferrer"
                    data-tip="Open this photo full-size in a new tab"
                    className="block aspect-square rounded border border-slate-200 dark:border-[#233350] overflow-hidden bg-slate-50 dark:bg-[#0B1220]"
                  >
                    {photo.url ? (
                      <img src={photo.url} alt={photo.file_name || "Offering photo"} className="w-full h-full object-cover" />
                    ) : (
                      <span className="flex items-center justify-center w-full h-full text-[10px] text-slate-400">Unavailable</span>
                    )}
                  </a>
                ))}
              </div>
            </div>
          )}

          {(gift.giverName || gift.giverEmail) && (
            <div className="rounded bg-slate-50 dark:bg-[#0B1220] p-3 text-xs text-slate-500 dark:text-slate-400">
              Pledged by: <span className="font-semibold text-slate-700 dark:text-slate-200">{gift.giverName || "Giver"}</span>{gift.giverEmail ? ` (${gift.giverEmail})` : ""}
            </div>
          )}

          {gift.claimedByOrgName && (
            <div className="rounded bg-blue-50 dark:bg-blue-950/30 p-3 text-xs font-semibold text-blue-700 dark:text-blue-300">
              Claimed by: {gift.claimedByOrgName}
            </div>
          )}

          {gift.status === "rejected" && gift.rejection_reason && (
            <div className="rounded bg-red-50 dark:bg-red-950/30 p-3 text-xs font-semibold text-red-700 dark:text-red-300">
              Reason: {gift.rejection_reason}
            </div>
          )}

          {/* Admin: initial moderation. Financial pledges are approved
              automatically once their donation is confirmed (see
              lib/paypal-donation.ts / the PayFast ITN / the admin donation
              review route) - they're never manually approved here, only
              cancelled if abandoned. */}
          {role === "admin" && gift.status === "pending" && gift.offering_type === "financial" && onModerate && (
            <DialogFooter className="gap-2 pt-1">
              <p className="text-xs text-amber-600 dark:text-amber-400 font-semibold flex-1">
                Awaiting payment confirmation - this pledge is approved automatically once its donation is confirmed.
              </p>
              <Button type="button" variant="outline" onClick={() => run(() => onModerate("rejected"))} disabled={isSubmitting} className="text-red-600 border-red-200 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/30">
                <XCircle className="w-4 h-4" /> Cancel pledge
              </Button>
            </DialogFooter>
          )}

          {role === "admin" && gift.status === "pending" && gift.offering_type !== "financial" && onModerate && (
            <DialogFooter className="gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => run(() => onModerate("rejected"))} disabled={isSubmitting} className="text-red-600 border-red-200 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/30">
                <XCircle className="w-4 h-4" /> Reject listing
              </Button>
              <Button type="button" onClick={() => run(() => onModerate("approved"))} disabled={isSubmitting} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ThumbsUp className="w-4 h-4" />}
                <span>Approve listing</span>
              </Button>
            </DialogFooter>
          )}

          {/* Admin: every claim on this offering, each reviewed on its own -
              approving one automatically declines every other still-pending
              claim (see review_gift_claim). */}
          {role === "admin" && (gift.claims?.length ?? 0) > 0 && (
            <div className="space-y-3 pt-1">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Claims on this offering</p>
              {[...pendingClaims, ...decidedClaims].map(claim => (
                <div key={claim.id} className="rounded border border-slate-200 dark:border-[#233350] p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className="text-sm font-bold">{claim.organization_name}</p>
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded capitalize ${claimStatusPillClasses(claim.status)}`}>{claim.status}</span>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-300 italic">"{claim.motivation}"</p>
                  {claim.documents.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {claim.documents.map(doc => (
                        <a
                          key={doc.id}
                          href={doc.url || undefined}
                          target="_blank"
                          rel="noreferrer"
                          data-tip="Open this supporting document in a new tab"
                          className="inline-flex items-center gap-1.5 rounded border border-slate-200 dark:border-[#233350] bg-slate-50 dark:bg-[#0B1220] px-2.5 py-1.5 text-[11px] font-bold text-blue-600 hover:underline"
                        >
                          <FileText className="w-3 h-3 shrink-0" /> {doc.file_name || "Document"}
                        </a>
                      ))}
                    </div>
                  )}
                  {claim.status !== "pending" && claim.claim_notes && (
                    <p className="text-xs text-red-600 dark:text-red-400">Note: {claim.claim_notes}</p>
                  )}
                  {onClaimDelete && (
                    <div className="flex justify-end">
                      <AdminDeleteButton kind="claim" id={claim.id} label="Delete claim" onDeleted={() => deleteClaim(claim.id)} />
                    </div>
                  )}
                  {claim.status === "pending" && onClaimReview && (
                    reviewingClaimId === claim.id ? (
                      <div className="space-y-2">
                        <div className="flex justify-end">
                          <GrammarCheckButton
                            text={claimReasonById[claim.id] || ""}
                            onTextChange={text => setClaimReasonById(prev => ({ ...prev, [claim.id]: text }))}
                          />
                        </div>
                        <div className="relative">
                          <textarea
                            value={claimReasonById[claim.id] || ""}
                            onChange={(e) => setClaimReasonById(prev => ({ ...prev, [claim.id]: e.target.value }))}
                            placeholder="Reason for declining (optional, shared with the organization)..."
                            className="w-full min-h-16 p-3 pr-11 bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#233350] rounded text-sm outline-none focus:border-red-500"
                          />
                          <MicButton className="top-2 right-2" onText={text => setClaimReasonById(prev => ({ ...prev, [claim.id]: appendSpeech(prev[claim.id] || "", text) }))} />
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button type="button" variant="outline" size="sm" onClick={() => setReviewingClaimId(null)} disabled={isSubmitting}>Cancel</Button>
                          <Button type="button" variant="outline" size="sm" onClick={() => reviewClaim(claim.id, false)} disabled={isSubmitting} className="text-red-600 border-red-200 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/30">
                            {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                            <span>Confirm decline</span>
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => setReviewingClaimId(claim.id)} disabled={isSubmitting} className="text-red-600 border-red-200 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/30">
                          <ThumbsDown className="w-3.5 h-3.5" /> Decline
                        </Button>
                        <Button type="button" size="sm" onClick={() => reviewClaim(claim.id, true)} disabled={isSubmitting} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                          {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ThumbsUp className="w-3.5 h-3.5" />}
                          <span>Approve claim</span>
                        </Button>
                      </div>
                    )
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Organization: claim with motivation + optional supporting documents */}
          {role === "organization" && gift.status === "approved" && canClaim && onClaim && (
            <div className="space-y-2 pt-1">
              {gift.myClaimPending ? (
                <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 rounded bg-amber-50 dark:bg-amber-950/30 p-3">
                  Your organization already has a claim on this offering awaiting a decision.
                </p>
              ) : showClaimForm ? (
                <>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <label className="text-xs font-bold text-slate-600 dark:text-slate-300">
                        Why does your organization need this? <span className="text-red-500">*</span>
                      </label>
                      <GrammarCheckButton text={motivation} onTextChange={setMotivation} />
                    </div>
                    <div className="relative">
                      <textarea
                        required
                        value={motivation}
                        onChange={(e) => setMotivation(e.target.value)}
                        placeholder="Tell the admin why your organization needs this offering..."
                        className="w-full min-h-20 p-3 pr-11 bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#233350] rounded text-sm outline-none focus:border-purple-500"
                      />
                      <MicButton className="top-2 right-2" onText={text => setMotivation(m => appendSpeech(m, text))} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Supporting documents (optional)</label>
                    {claimDocuments.length > 0 && (
                      <ul className="space-y-1.5">
                        {claimDocuments.map((file, index) => (
                          <li key={`${file.name}-${index}`} className="flex items-center justify-between gap-2 rounded bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#233350] px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                            <span className="truncate">{file.name}</span>
                            <button
                              type="button"
                              onClick={() => setClaimDocuments(docs => docs.filter((_, i) => i !== index))}
                              aria-label={`Remove ${file.name}`}
                              data-tip="Remove this document"
                              className="text-slate-400 hover:text-red-600 shrink-0 font-bold px-1"
                            >
                              ✕
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                    <label
                      data-tip="You can attach multiple documents - select several at once, or add them one at a time"
                      className="flex flex-col items-center justify-center gap-2 rounded border-2 border-dashed border-slate-300 dark:border-[#233350] p-4 text-center cursor-pointer hover:border-purple-400 transition-colors"
                    >
                      <UploadCloud className="w-5 h-5 text-slate-400" />
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                        {claimDocuments.length === 0 ? "Click to attach file(s) - image or PDF" : "Click to attach more files"}
                      </span>
                      <input
                        type="file"
                        multiple
                        accept="image/*,application/pdf"
                        className="hidden"
                        onChange={(e) => {
                          setClaimDocuments(docs => [...docs, ...Array.from(e.target.files || [])])
                          e.target.value = ""
                        }}
                      />
                        <span className="block text-[11px] font-normal text-slate-500 dark:text-slate-400">{describeUploadLimit(UPLOAD_LIMITS.giftClaimDocuments)}</span>
                    </label>
                  </div>
                  <DialogFooter className="gap-2">
                    <Button type="button" variant="outline" onClick={() => setShowClaimForm(false)}>Cancel</Button>
                    <Button
                      type="button"
                      onClick={() => run(() => onClaim(motivation, claimDocuments))}
                      disabled={isSubmitting || !motivation.trim()}
                      data-tip="Send this claim to an administrator for approval"
                      className="bg-purple-600 hover:bg-purple-700 text-white"
                    >
                      {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gift className="w-4 h-4" />}
                      <span>Submit claim request</span>
                    </Button>
                  </DialogFooter>
                </>
              ) : (
                <Button type="button" onClick={() => setShowClaimForm(true)} className="w-full bg-purple-600 hover:bg-purple-700 text-white">
                  <Gift className="w-4 h-4" /> Claim for Organization
                </Button>
              )}
            </div>
          )}

          {role === "organization" && gift.status === "approved" && !canClaim && (
            <p className="text-xs text-amber-600 dark:text-amber-400 font-semibold">Your organization must be approved by an administrator before claiming offerings.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
