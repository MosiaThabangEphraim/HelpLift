"use client"

import { Star } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export type FeedbackDetail = {
  id: string
  sender_role: string
  sender_name: string
  sender_email: string | null
  rating: number
  message: string | null
  created_at: string
}

function Stars({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map(n => (
        <Star key={n} className={`h-4 w-4 ${n <= value ? "fill-amber-400 text-amber-400" : "text-slate-300 dark:text-slate-600"}`} />
      ))}
    </span>
  )
}

// Full read-out of one piece of platform feedback for the admin's Feedback
// tab - the list row is a compact, truncated preview; this is where the
// whole comment and sender details are actually read.
export function FeedbackDetailDialog({
  open,
  onOpenChange,
  feedback,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  feedback: FeedbackDetail | null
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Feedback</DialogTitle>
        </DialogHeader>
        {feedback && (
          <div className="space-y-4 pt-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <Stars value={feedback.rating} />
                <span className="text-sm font-bold">{feedback.sender_name}</span>
                <span className="rounded bg-slate-100 dark:bg-[#1A2740] px-2 py-0.5 text-[11px] font-bold capitalize text-slate-600 dark:text-slate-300">
                  {feedback.sender_role}
                </span>
              </div>
              <span className="text-[11px] text-slate-400">{new Date(feedback.created_at).toLocaleString()}</span>
            </div>

            {feedback.message ? (
              <p className="whitespace-pre-line text-sm text-slate-700 dark:text-slate-300">{feedback.message}</p>
            ) : (
              <p className="text-sm italic text-slate-400">No comment.</p>
            )}

            {feedback.sender_email && (
              <p className="text-xs text-slate-400">{feedback.sender_email}</p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
