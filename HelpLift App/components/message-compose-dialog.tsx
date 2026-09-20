"use client"

import { FormEvent, useEffect, useState } from "react"
import { Loader2, Paperclip, Send, X } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

type MessageComposeDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  recipientLabel: string
  /** Set to "admin" to message any administrator; otherwise pass recipientId. */
  target?: "admin"
  recipientId?: string
  onSent?: () => void
  /** Pre-fills the message body (e.g. a thank-you template) — still editable before sending. */
  defaultMessage?: string
  /** Set when replying: the message being answered (recorded with the reply, and quoted to the recipient). */
  replyTo?: { id: string; snippet: string }
}

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024 // 10MB

export function MessageComposeDialog({ open, onOpenChange, recipientLabel, target, recipientId, onSent, defaultMessage, replyTo }: MessageComposeDialogProps) {
  const [message, setMessage] = useState("")
  const [attachments, setAttachments] = useState<File[]>([])
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState("")
  const [sent, setSent] = useState(false)

  useEffect(() => {
    if (open) setMessage(defaultMessage || "")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const close = () => {
    onOpenChange(false)
    setTimeout(() => {
      setMessage("")
      setAttachments([])
      setError("")
      setSent(false)
    }, 200)
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!message.trim()) return
    const oversized = attachments.find((f) => f.size > MAX_ATTACHMENT_BYTES)
    if (oversized) {
      setError(`"${oversized.name}" is too large (10MB max).`)
      return
    }
    setIsSending(true)
    setError("")
    try {
      const formData = new FormData()
      formData.append("message", message)
      if (replyTo) formData.append("replyTo", replyTo.id)
      else if (target === "admin") formData.append("target", "admin")
      else if (recipientId) formData.append("recipientId", recipientId)
      attachments.forEach((file) => formData.append("attachments", file))

      const res = await fetch("/api/messages", { method: "POST", body: formData })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || "Unable to send message.")
      setSent(true)
      onSent?.()
      setTimeout(close, 1200)
    } catch (err: any) {
      setError(err.message || "Unable to send message.")
    } finally {
      setIsSending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{replyTo ? "Reply to" : "Message"} {recipientLabel}</DialogTitle>
        </DialogHeader>
        {sent ? (
          <p className="py-6 text-center text-sm font-semibold text-emerald-600 dark:text-emerald-400">
            Message sent — it will appear in {recipientLabel}'s notifications.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3 pt-2">
            {error && (
              <div className="rounded-xl bg-red-50 dark:bg-red-950/40 p-3 text-sm font-semibold text-red-700 dark:text-red-300">
                {error}
              </div>
            )}
            {replyTo && (
              <blockquote className="rounded-xl border-l-4 border-blue-500 bg-slate-50 dark:bg-[#0B1220] px-3 py-2 text-xs text-slate-600 dark:text-slate-300">
                <p className="mb-0.5 font-bold text-slate-500 dark:text-slate-400">Replying to</p>
                <p className="line-clamp-3 whitespace-pre-line">{replyTo.snippet}</p>
              </blockquote>
            )}
            <div className="space-y-1">
              <Label htmlFor="message-compose-body">{replyTo ? "Your reply" : "Message"}</Label>
              <textarea
                id="message-compose-body"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={`Write your message to ${recipientLabel}...`}
                required
                maxLength={2000}
                className="w-full min-h-32 rounded-xl border border-slate-200 dark:border-[#233350] bg-white dark:bg-[#0B1220] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>
            <div className="space-y-1">
              <Label>Attachments (optional)</Label>
              {attachments.map((file, index) => (
                <div key={`${file.name}-${index}`} className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 dark:border-[#233350] bg-slate-50 dark:bg-[#0B1220] px-3 py-2 text-sm">
                  <span className="truncate">{file.name}</span>
                  <button aria-label="Remove" type="button" onClick={() => setAttachments(files => files.filter((_, i) => i !== index))} className="shrink-0 text-slate-400 hover:text-red-500">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <label className="flex items-center gap-2 rounded-xl border border-dashed border-slate-300 dark:border-[#233350] px-3 py-2 text-sm text-slate-500 dark:text-slate-400 cursor-pointer hover:border-blue-400">
                <Paperclip className="w-4 h-4 shrink-0" />
                <span>{attachments.length > 0 ? "Attach another file (max 10MB each)" : "Attach a file (max 10MB)"}</span>
                <input
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => setAttachments(files => [...files, ...Array.from(e.target.files || [])])}
                />
              </label>
            </div>
            <DialogFooter className="pt-2 gap-2">
              <Button type="button" variant="outline" onClick={close}>Cancel</Button>
              <Button type="submit" disabled={isSending} className="bg-blue-600 hover:bg-blue-700 text-white">
                {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                <span>{isSending ? "Sending..." : "Send"}</span>
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
