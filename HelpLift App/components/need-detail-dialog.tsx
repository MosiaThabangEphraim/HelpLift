"use client"

import { useEffect, useState } from "react"
import { Banknote, Calendar, ClipboardList, Loader2, MapPin, Package, ThumbsDown, ThumbsUp, XCircle } from "lucide-react"
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

export type NeedDetailSummary = {
  id: string
  title: string
  description: string
  category: string
  urgency?: string
  status: "draft" | "open" | "in_progress" | "fulfilled" | "closed" | "rejected" | "reopen_pending" | string
  rejection_reason?: string | null
  reopen_reason?: string | null
  organization_name?: string | null
  location?: string | null
  quantity?: string | null
  target_amount?: number | string | null
  due_date?: string | null
  created_at: string
  attachments?: { id: string; file_name: string | null; url: string }[]
}

export function statusBadgeClassesForNeed(status: string) {
  if (status === "open" || status === "in_progress") return "bg-emerald-50 text-emerald-700"
  if (status === "fulfilled") return "bg-blue-50 text-blue-700"
  if (status === "draft") return "bg-amber-50 text-amber-700"
  if (status === "reopen_pending") return "bg-purple-50 text-purple-700"
  if (status === "rejected") return "bg-red-50 text-red-700"
  return "bg-slate-100 dark:bg-[#1A2740] text-slate-700 dark:text-slate-300"
}

// Full read-out of a need for an administrator deciding whether to approve
// it - title, org, category, urgency, location, quantity, target amount, due
// date, description and attachments, with the moderation actions attached so
// there's no need to go back to the list to act on it.
export function NeedDetailDialog({
  open,
  onOpenChange,
  need,
  onUpdate,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  need: NeedDetailSummary | null
  onUpdate: (id: string, status: "open" | "fulfilled" | "rejected" | "closed", rejection_reason?: string) => Promise<void> | void
}) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showRejectForm, setShowRejectForm] = useState(false)
  const [rejectReason, setRejectReason] = useState("")

  useEffect(() => {
    if (open) {
      setShowRejectForm(false)
      setRejectReason("")
      setIsSubmitting(false)
    }
  }, [open, need?.id])

  if (!need) return null

  const isReopenRequest = need.status === "reopen_pending"
  const canModerate = need.status === "draft" || need.status === "rejected" || isReopenRequest

  const run = async (fn: () => Promise<void> | void) => {
    setIsSubmitting(true)
    try {
      await fn()
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 pr-6">
            <ClipboardList className="w-5 h-5 text-blue-600 shrink-0" />
            <span>{need.title}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[11px] font-bold px-2.5 py-1 rounded capitalize ${statusBadgeClassesForNeed(need.status)}`}>{need.status.replace(/_/g, " ")}</span>
            {need.urgency === "high" && <span className="text-[11px] font-bold px-2.5 py-1 rounded bg-red-100 text-red-700">High Urgency</span>}
            <span className="text-[11px] font-bold px-2.5 py-1 rounded bg-slate-100 dark:bg-[#1A2740]">{need.category}</span>
          </div>

          <p className="text-sm text-slate-500 dark:text-slate-400">
            {need.organization_name || "Organization"} · Submitted {new Date(need.created_at).toLocaleDateString()}
          </p>

          <div className="grid grid-cols-2 gap-3 text-sm">
            {need.location && (
              <div className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>{need.location}</span>
              </div>
            )}
            {need.quantity && (
              <div className="flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>{need.quantity}</span>
              </div>
            )}
            {need.target_amount != null && need.target_amount !== "" && (
              <div className="flex items-center gap-1.5">
                <Banknote className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>{formatCurrency(Number(need.target_amount))} target</span>
              </div>
            )}
            {need.due_date && (
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>Due {new Date(need.due_date).toLocaleDateString()}</span>
              </div>
            )}
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Description</p>
            <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300 whitespace-pre-line">{need.description}</p>
          </div>

          {need.attachments && need.attachments.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Attachments</p>
              <div className="flex flex-wrap gap-2">
                {need.attachments.map(att => (
                  <a key={att.id} href={att.url} target="_blank" rel="noreferrer" className="block">
                    {/\.(png|jpe?g|gif|webp)$/i.test(att.file_name || att.url) ? (
                      <img src={att.url} alt={att.file_name || "Attachment"} className="h-16 w-16 rounded object-cover border border-slate-200 dark:border-[#233350]" />
                    ) : (
                      <span className="flex items-center justify-center h-16 w-16 rounded border border-slate-200 dark:border-[#233350] text-[10px] font-bold text-blue-600 text-center px-1">📄 {att.file_name?.slice(0, 10) || "File"}</span>
                    )}
                  </a>
                ))}
              </div>
            </div>
          )}

          {need.status === "rejected" && need.rejection_reason && (
            <p className="text-xs italic text-red-700 dark:text-red-400 rounded bg-red-50 dark:bg-red-950/20 p-3">Previous rejection reason: {need.rejection_reason}</p>
          )}

          {isReopenRequest && need.reopen_reason && (
            <p className="text-xs italic text-purple-700 dark:text-purple-400 rounded bg-purple-50 dark:bg-purple-950/20 p-3">Organization's motivation for reopening: {need.reopen_reason}</p>
          )}

          {showRejectForm && (
            <div>
              <div className="flex justify-end mb-1">
                <GrammarCheckButton text={rejectReason} onTextChange={setRejectReason} />
              </div>
              <div className="relative">
                <textarea
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                  placeholder={isReopenRequest ? "Reason for declining the reopen request (optional, shared with the organization)..." : "Reason for rejection (optional, shared with the organization)..."}
                  className="w-full min-h-16 p-3 pr-11 bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#233350] rounded text-sm outline-none focus:border-red-500"
                />
                <MicButton className="top-2 right-2" onText={text => setRejectReason(r => appendSpeech(r, text))} />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 pt-1">
            {canModerate && (
              showRejectForm ? (
                <>
                  <Button type="button" variant="outline" onClick={() => setShowRejectForm(false)} disabled={isSubmitting}>Cancel</Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isSubmitting}
                    onClick={() => run(() => onUpdate(need.id, isReopenRequest ? "closed" : "rejected", rejectReason.trim() || undefined))}
                    className="text-red-600 border-red-200 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/30"
                  >
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                    <span>{isReopenRequest ? "Confirm decline" : "Confirm reject"}</span>
                  </Button>
                </>
              ) : (
                <>
                  <Button type="button" variant="outline" onClick={() => setShowRejectForm(true)} disabled={isSubmitting} className="text-red-600 border-red-200 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/30">
                    <ThumbsDown className="w-4 h-4" /> {isReopenRequest ? "Decline" : "Reject"}
                  </Button>
                  <Button type="button" onClick={() => run(() => onUpdate(need.id, "open"))} disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700 text-white">
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ThumbsUp className="w-4 h-4" />}
                    <span>{isReopenRequest ? "Approve reopen" : "Approve & Publish"}</span>
                  </Button>
                </>
              )
            )}
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}
