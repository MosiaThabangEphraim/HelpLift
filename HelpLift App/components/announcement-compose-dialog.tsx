"use client"

import { FormEvent, useState } from "react"
import { Bell, Loader2, Megaphone, MonitorSmartphone, Paperclip, X } from "lucide-react"
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
import { MicButton } from "@/components/mic-button"
import { GrammarCheckButton } from "@/components/grammar-check-button"
import { appendSpeech } from "@/lib/speech-to-text"

type Target = "givers" | "organizations" | "both"
type DeliveryType = "notification" | "banner" | "both"

const TARGET_OPTIONS: { value: Target; label: string }[] = [
  { value: "givers", label: "All Givers" },
  { value: "organizations", label: "All Organizations" },
  { value: "both", label: "Everyone" },
]

// Every notification insert also triggers an automatic email to that
// recipient (api/webhooks/notification-created) - worth spelling out here
// since an admin choosing "In-app notification" might not otherwise realize
// it isn't in-app-only.
const DELIVERY_OPTIONS: { value: DeliveryType; label: string; description: string; icon: typeof Bell }[] = [
  { value: "notification", label: "In-app notification", description: "Sent to signed-in users/organizations - also emails each of them", icon: Bell },
  { value: "banner", label: "Login page banner", description: "Dismissible note on the login page, for everyone - no email", icon: MonitorSmartphone },
  { value: "both", label: "Both", description: "Notification (+ email) and login page banner", icon: Megaphone },
]

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024 // 10MB

// One compose flow for every kind of announcement an admin can push out -
// an in-app notification (existing behavior, broadcast to signed-in
// users/organizations), the dismissible /login page banner (see
// 20260928000300_login_banner.sql), or both from the same message. Turning
// the login banner back OFF later doesn't need a new announcement - that's
// a "Turn off" action in Platform Settings instead (PlatformSettingsAdmin).
export function AnnouncementComposeDialog({
  open,
  onOpenChange,
  onSent,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSent?: () => void
}) {
  const [deliveryType, setDeliveryType] = useState<DeliveryType>("notification")
  const [target, setTarget] = useState<Target>("both")
  const [title, setTitle] = useState("")
  const [message, setMessage] = useState("")
  const [attachments, setAttachments] = useState<File[]>([])
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState("")
  const [result, setResult] = useState<{ recipientCount: number; bannerUpdated: boolean } | null>(null)

  const includesNotification = deliveryType !== "banner"
  const includesBanner = deliveryType !== "notification"

  const close = () => {
    onOpenChange(false)
    setTimeout(() => {
      setDeliveryType("notification")
      setTarget("both")
      setTitle("")
      setMessage("")
      setAttachments([])
      setError("")
      setResult(null)
    }, 200)
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!message.trim()) return
    if (includesNotification && !title.trim()) return
    const oversized = attachments.find((f) => f.size > MAX_ATTACHMENT_BYTES)
    if (oversized) {
      setError(`"${oversized.name}" is too large (10MB max).`)
      return
    }
    setIsSending(true)
    setError("")
    try {
      const formData = new FormData()
      formData.append("deliveryType", deliveryType)
      formData.append("target", target)
      formData.append("title", title)
      formData.append("message", message)
      attachments.forEach((file) => formData.append("attachments", file))

      const res = await fetch("/api/admin/announcements", { method: "POST", body: formData })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || "Unable to send announcement.")
      setResult({ recipientCount: data.recipientCount ?? 0, bannerUpdated: !!data.bannerUpdated })
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
        {result !== null ? (
          <p className="py-6 text-center text-sm font-semibold text-emerald-600 dark:text-emerald-400">
            {includesNotification && `Announcement sent (and emailed) to ${result.recipientCount} recipient${result.recipientCount === 1 ? "" : "s"}.`}
            {includesNotification && includesBanner && <br />}
            {includesBanner && "Login page banner is now live."}
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3 pt-2">
            {error && (
              <div className="rounded-xl bg-red-50 dark:bg-red-950/40 p-3 text-sm font-semibold text-red-700 dark:text-red-300">
                {error}
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Deliver as</Label>
              <div className="grid grid-cols-1 gap-2">
                {DELIVERY_OPTIONS.map((option) => {
                  const Icon = option.icon
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setDeliveryType(option.value)}
                      className={`flex items-center gap-2.5 rounded-xl border-2 px-3 py-2 text-left transition-colors ${
                        deliveryType === option.value
                          ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30"
                          : "border-slate-200 dark:border-[#233350] hover:border-slate-300 dark:hover:border-[#2C3E63]"
                      }`}
                    >
                      <Icon className="w-4 h-4 text-blue-600 shrink-0" />
                      <span className="min-w-0">
                        <span className="block text-xs font-bold">{option.label}</span>
                        <span className="block text-[11px] text-slate-500 dark:text-slate-400">{option.description}</span>
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            {includesNotification && (
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
                <p className="text-[11px] text-slate-400">
                  Each recipient also gets this by email automatically.
                  {includesBanner && " This audience only applies to the notification - the login page banner always shows to everyone, signed in or not."}
                </p>
              </div>
            )}

            {includesNotification && (
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
            )}
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="announcement-message">Message</Label>
                <GrammarCheckButton text={message} onTextChange={setMessage} />
              </div>
              <div className="relative">
                <textarea
                  id="announcement-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Write your announcement..."
                  required
                  maxLength={2000}
                  className="w-full min-h-32 rounded-xl border border-slate-200 dark:border-[#233350] bg-white dark:bg-[#0B1220] px-3 py-2 pr-11 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
                <MicButton className="top-2 right-2" onText={text => setMessage(m => appendSpeech(m, text))} />
              </div>
              {includesBanner && (
                <p className="text-[11px] text-slate-400">
                  {includesNotification ? "Only the message (not the title) appears on the login page banner." : "Shown as-is on the login page banner."}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <Label>Attachments (optional)</Label>
              <p className="text-[11px] text-slate-400 -mt-0.5">
                {includesNotification && includesBanner
                  ? "Documents or pictures sent with the notification and shown on the login page banner."
                  : includesNotification
                  ? "Documents or pictures sent with the in-app notification."
                  : "Documents or pictures shown on the login page banner."}
              </p>
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
                <span>{attachments.length > 0 ? "Attach another file (max 10MB each)" : "Attach documents or pictures (max 10MB each)"}</span>
                <input
                  type="file"
                  multiple
                  accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx"
                  className="hidden"
                  onChange={(e) => setAttachments(files => [...files, ...Array.from(e.target.files || [])])}
                />
              </label>
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
