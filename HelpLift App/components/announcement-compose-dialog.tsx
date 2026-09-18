"use client"

import { FormEvent, useState } from "react"
import { Loader2, Megaphone } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"

type Target = "givers" | "organizations" | "both"

const TARGET_OPTIONS: { value: Target; label: string }[] = [
  { value: "givers", label: "All Users" },
  { value: "organizations", label: "All Organizations" },
  { value: "both", label: "Everyone" },
]

export function AnnouncementComposeDialog({
  open,
  onOpenChange,
  onSent,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSent?: () => void
}) {
  const [target, setTarget] = useState<Target>("both")
  const [title, setTitle] = useState("")
  const [message, setMessage] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState("")
  const [sentCount, setSentCount] = useState<number | null>(null)

  const close = () => {
    onOpenChange(false)
    setTimeout(() => {
      setTarget("both")
      setTitle("")
      setMessage("")
      setError("")
      setSentCount(null)
    }, 200)
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!title.trim() || !message.trim()) return
    setIsSending(true)
    setError("")
    try {
      const res = await fetch("/api/admin/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target, title, message }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || "Unable to send announcement.")
      setSentCount(data.recipientCount ?? 0)
      onSent?.()
      setTimeout(close, 1800)
    } catch (err: any) {
      setError(err.message || "Unable to send announcement.")
    } finally {
      setIsSending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-blue-600" />
            Send Announcement
          </DialogTitle>
        </DialogHeader>
        {sentCount !== null ? (
          <p className="py-6 text-center text-sm font-semibold text-emerald-600 dark:text-emerald-400">
            Announcement sent to {sentCount} recipient{sentCount === 1 ? "" : "s"}.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3 pt-2">
            {error && (
              <div className="rounded-xl bg-red-50 dark:bg-red-950/40 p-3 text-sm font-semibold text-red-700 dark:text-red-300">
                {error}
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Send to</Label>
              <div className="grid grid-cols-3 gap-2">
                {TARGET_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setTarget(option.value)}
                    className={`rounded-xl border-2 px-2 py-2 text-xs font-bold transition-colors ${
                      target === option.value
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300"
                        : "border-slate-200 dark:border-[#233350] text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-[#2C3E63]"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="announcement-title">Title</Label>
              <Input
                id="announcement-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Scheduled maintenance this weekend"
                maxLength={200}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="announcement-message">Message</Label>
              <textarea
                id="announcement-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Write your announcement..."
                required
                maxLength={2000}
                className="w-full min-h-32 rounded-xl border border-slate-200 dark:border-[#233350] bg-white dark:bg-[#0B1220] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>
            <DialogFooter className="pt-2 gap-2">
              <Button type="button" variant="outline" onClick={close}>Cancel</Button>
              <Button type="submit" disabled={isSending} className="bg-blue-600 hover:bg-blue-700 text-white">
                {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Megaphone className="w-4 h-4" />}
                <span>{isSending ? "Sending..." : "Send Announcement"}</span>
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
