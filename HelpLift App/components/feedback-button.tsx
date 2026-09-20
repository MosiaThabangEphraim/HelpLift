"use client"

import { useState } from "react"
import { CheckCircle2, Loader2, Send, Star } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

const RATING_WORDS = ["", "Poor", "Fair", "Good", "Very good", "Excellent"]

// Header icon (next to the dark-mode toggle and notifications) that lets a giver
// or organization rate HelpLift and say how it could improve, whenever they
// like. Goes to the administrators as a notification and email.
export function FeedbackButton({ className = "" }: { className?: string }) {
  const [open, setOpen] = useState(false)
  const [rating, setRating] = useState(0)
  const [hovered, setHovered] = useState(0)
  const [message, setMessage] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState("")

  const reset = () => {
    setRating(0)
    setHovered(0)
    setMessage("")
    setSent(false)
    setError("")
  }

  const close = () => {
    setOpen(false)
    setTimeout(reset, 200)
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (rating === 0) {
      setError("Choose a rating from 1 to 5 stars.")
      return
    }
    setIsSending(true)
    setError("")
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, message }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || "Could not send your feedback.")
      setSent(true)
      setTimeout(close, 2200)
    } catch (err: any) {
      setError(err.message || "Could not send your feedback.")
    } finally {
      setIsSending(false)
    }
  }

  const shown = hovered || rating

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Rate HelpLift and send feedback"
        data-tip="Rate HelpLift and tell us how we can improve. It goes straight to our admins."
        className={`inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors ${className}`}
      >
        <Star className="w-4 h-4" />
      </button>

      <Dialog open={open} onOpenChange={next => (next ? setOpen(true) : close())}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rate HelpLift</DialogTitle>
            <DialogDescription>
              Tell us how we're doing and how we can improve. Your feedback goes straight to the HelpLift admins. You can send it any time.
            </DialogDescription>
          </DialogHeader>

          {sent ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <CheckCircle2 className="h-10 w-10 text-emerald-500" />
              <p className="font-semibold text-emerald-600 dark:text-emerald-400">Thank you! Your feedback has been sent.</p>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4 pt-1">
              {error && (
                <div className="rounded-xl bg-red-50 dark:bg-red-950/40 p-3 text-sm font-semibold text-red-700 dark:text-red-300">{error}</div>
              )}

              <div className="space-y-2">
                <Label>Your rating</Label>
                <div className="flex items-center gap-1" role="radiogroup" aria-label="Rating out of 5" onMouseLeave={() => setHovered(0)}>
                  {[1, 2, 3, 4, 5].map(value => (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={rating === value}
                      aria-label={`${value} star${value === 1 ? "" : "s"}`}
                      onMouseEnter={() => setHovered(value)}
                      onFocus={() => setHovered(value)}
                      onBlur={() => setHovered(0)}
                      onClick={() => setRating(value)}
                      className="rounded-md p-1 transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    >
                      <Star className={`h-8 w-8 ${value <= shown ? "fill-amber-400 text-amber-400" : "text-slate-300 dark:text-slate-600"}`} />
                    </button>
                  ))}
                  {shown > 0 && <span className="ml-2 text-sm font-semibold text-slate-600 dark:text-slate-300">{RATING_WORDS[shown]}</span>}
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="feedback-message">How can we improve? <span className="text-xs font-normal text-slate-400">(optional)</span></Label>
                <textarea
                  id="feedback-message"
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  maxLength={2000}
                  placeholder="What's working well? What's confusing, missing or could be better?"
                  className="w-full min-h-32 rounded-xl border border-slate-200 dark:border-[#233350] bg-white dark:bg-[#0B1220] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
                <p className="text-right text-[11px] text-slate-400">{message.length}/2000</p>
              </div>

              <DialogFooter className="gap-2">
                <Button type="button" variant="outline" onClick={close}>Cancel</Button>
                <Button type="submit" disabled={isSending} className="bg-blue-600 hover:bg-blue-700 text-white">
                  {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  <span>{isSending ? "Sending..." : "Send feedback"}</span>
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
