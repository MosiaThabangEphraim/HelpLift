"use client"

import { useEffect, useState } from "react"
import { Gift, Loader2, MapPin, Calendar, ThumbsDown, ThumbsUp, XCircle } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { formatCurrency } from "@/lib/banking"

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
  claim_notes?: string | null
  claim_motivation?: string | null
  created_at: string
  giverName?: string | null
  giverEmail?: string | null
  claimedByOrgName?: string | null
}

type Role = "admin" | "organization"

export function statusPillClasses(status: string) {
  if (status === "approved") return "bg-emerald-50 text-emerald-700"
  if (status === "claimed") return "bg-blue-50 text-blue-700"
  if (status === "pending_claim") return "bg-amber-50 text-amber-700"
  if (status === "rejected") return "bg-red-50 text-red-700"
  return "bg-slate-100 dark:bg-[#1A2740] text-slate-700 dark:text-slate-300"
}

type GiftDetailDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  gift: GiftDetailSummary | null
  role: Role
  canClaim?: boolean
  onModerate?: (status: "approved" | "rejected") => Promise<void> | void
  onClaimReview?: (status: "claimed" | "approved", claimNotes?: string) => Promise<void> | void
  onClaim?: (motivation: string) => Promise<void> | void
}

export function GiftDetailDialog({ open, onOpenChange, gift, role, canClaim, onModerate, onClaimReview, onClaim }: GiftDetailDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showRejectForm, setShowRejectForm] = useState(false)
  const [rejectNotes, setRejectNotes] = useState("")
  const [showClaimForm, setShowClaimForm] = useState(false)
  const [motivation, setMotivation] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    setShowRejectForm(false)
    setRejectNotes("")
    setShowClaimForm(false)
    setMotivation("")
    setError("")
  }, [gift])

  if (!gift) return null

  const isFinancial = gift.offering_type === "financial"

  const run = async (fn?: () => Promise<void> | void) => {
    if (!fn) return
    setIsSubmitting(true)
    setError("")
    try {
      await fn()
      onOpenChange(false)
    } catch (err: any) {
      setError(err?.message || "Something went wrong.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gift className="w-5 h-5 text-purple-600" />
            {gift.title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {error && (
            <div className="rounded-xl bg-red-50 dark:bg-red-950/40 p-3 text-sm font-semibold text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 capitalize">{gift.offering_type}</span>
            <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full capitalize ${statusPillClasses(gift.status)}`}>
              {gift.status === "pending_claim" ? "Claim pending" : gift.status}
            </span>
          </div>

          <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-line">{gift.description}</p>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{isFinancial ? "Amount" : "Quantity / Value"}</p>
              <p className="font-bold">{isFinancial && gift.quantity_or_value ? formatCurrency(Number(gift.quantity_or_value)) : (gift.quantity_or_value || "—")}</p>
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

          {(gift.giverName || gift.giverEmail) && (
            <div className="rounded-xl bg-slate-50 dark:bg-[#0B1220] p-3 text-xs text-slate-500 dark:text-slate-400">
              Pledged by: <span className="font-semibold text-slate-700 dark:text-slate-200">{gift.giverName || "Giver"}</span>{gift.giverEmail ? ` (${gift.giverEmail})` : ""}
            </div>
          )}

          {gift.claimedByOrgName && (
            <div className="rounded-xl bg-blue-50 dark:bg-blue-950/30 p-3 text-xs font-semibold text-blue-700 dark:text-blue-300">
              Claimed by: {gift.claimedByOrgName}
            </div>
          )}

          {gift.claim_motivation && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Claim motivation</p>
              <p className="text-sm text-slate-600 dark:text-slate-300 italic">"{gift.claim_motivation}"</p>
            </div>
          )}

          {gift.claim_notes && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Admin note</p>
              <p className="text-sm text-red-600 dark:text-red-400">{gift.claim_notes}</p>
            </div>
          )}

          {/* Admin: initial moderation */}
          {role === "admin" && gift.status === "pending" && onModerate && (
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

          {/* Admin: claim review */}
          {role === "admin" && gift.status === "pending_claim" && onClaimReview && (
            <div className="space-y-2 pt-1">
              {showRejectForm && (
                <textarea
                  value={rejectNotes}
                  onChange={(e) => setRejectNotes(e.target.value)}
                  placeholder="Reason for declining the claim (optional, shared with the organization)..."
                  className="w-full min-h-16 p-3 bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#233350] rounded-2xl text-sm outline-none focus:border-red-500"
                />
              )}
              <DialogFooter className="gap-2">
                {!showRejectForm ? (
                  <Button type="button" variant="outline" onClick={() => setShowRejectForm(true)} className="text-red-600 border-red-200 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/30">
                    <ThumbsDown className="w-4 h-4" /> Reject claim
                  </Button>
                ) : (
                  <Button type="button" variant="outline" onClick={() => run(() => onClaimReview("approved", rejectNotes))} disabled={isSubmitting} className="text-red-600 border-red-200 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/30">
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                    <span>Confirm decline</span>
                  </Button>
                )}
                <Button type="button" onClick={() => run(() => onClaimReview("claimed"))} disabled={isSubmitting} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ThumbsUp className="w-4 h-4" />}
                  <span>Approve claim</span>
                </Button>
              </DialogFooter>
            </div>
          )}

          {/* Organization: claim with motivation */}
          {role === "organization" && gift.status === "approved" && canClaim && onClaim && (
            <div className="space-y-2 pt-1">
              {showClaimForm ? (
                <>
                  <textarea
                    value={motivation}
                    onChange={(e) => setMotivation(e.target.value)}
                    placeholder="Tell the admin why your organization needs this offering..."
                    className="w-full min-h-20 p-3 bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#233350] rounded-2xl text-sm outline-none focus:border-purple-500"
                  />
                  <DialogFooter className="gap-2">
                    <Button type="button" variant="outline" onClick={() => setShowClaimForm(false)}>Cancel</Button>
                    <Button type="button" onClick={() => run(() => onClaim(motivation))} disabled={isSubmitting} className="bg-purple-600 hover:bg-purple-700 text-white">
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
