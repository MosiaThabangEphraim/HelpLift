"use client"

import { FormEvent, useEffect, useState } from "react"
import { stageFormFiles } from "@/lib/stage-uploads"
import { describeUploadLimit, UPLOAD_LIMITS } from "@/lib/upload-limits"
import { Bell, Check, Globe, Loader2, Megaphone, MonitorSmartphone, Paperclip, X } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { MicButton } from "@/components/mic-button"
import { GrammarCheckButton } from "@/components/grammar-check-button"
import { appendSpeech } from "@/lib/speech-to-text"

type Target = "givers" | "organizations" | "both"
type Channel = "notification" | "banner" | "homepage"

const TARGET_OPTIONS: { value: Target; label: string }[] = [
  { value: "givers", label: "All Givers" },
  { value: "organizations", label: "All Organizations" },
  { value: "both", label: "Everyone" },
]

// Every notification insert also triggers an automatic email to that
// recipient (api/webhooks/notification-created) - worth spelling out here
// since an admin choosing "In-app notification" might not otherwise realize
// it isn't in-app-only.
// Pick any combination.
const DELIVERY_OPTIONS: { value: Channel; label: string; description: string; icon: typeof Bell }[] = [
  { value: "notification", label: "In-app notification", description: "Sent to signed-in users/organizations - also emails each of them", icon: Bell },
  { value: "banner", label: "Login page banner", description: "Dismissible note on the login page, for everyone - no email", icon: MonitorSmartphone },
  { value: "homepage", label: "Homepage public notice", description: "Banner at the top of the homepage - everyone who opens the site sees it", icon: Globe },
]

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024 // 10MB

// One compose flow for every kind of announcement an admin can push out -
// an in-app notification (existing behavior, broadcast to signed-in
// users/organizations), the dismissible /login page banner (see
// 20260928000300_login_banner.sql) and the public homepage notice - any
// combination, from the same message. The "Live now" toggles at the top turn
// the login banner and homepage notice off (or back on with their last
// message) without sending anything new.

type LiveSetting = { enabled: boolean; title?: string; message: string; attachments: { path: string; name: string }[] }
type LiveKey = "login_banner" | "homepage_notice"
export function AnnouncementComposeDialog({
  open,
  onOpenChange,
  onSent,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSent?: () => void
}) {
  const [channels, setChannels] = useState<Channel[]>(["notification"])
  const [target, setTarget] = useState<Target>("both")
  const [title, setTitle] = useState("")
  const [message, setMessage] = useState("")
  const [attachments, setAttachments] = useState<File[]>([])
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState("")
  const [result, setResult] = useState<{ recipientCount: number; bannerUpdated: boolean } | null>(null)
  // What's live right now - the login banner and the homepage notice.
  const [live, setLive] = useState<Record<LiveKey, LiveSetting | null>>({ login_banner: null, homepage_notice: null })
  const [savingLive, setSavingLive] = useState<LiveKey | null>(null)
  const [liveError, setLiveError] = useState("")

  const loadLive = async () => {
    try {
      const res = await fetch("/api/admin/settings")
      const data = await res.json().catch(() => ({}))
      if (res.ok) setLive({ login_banner: data.loginBanner || null, homepage_notice: data.homepageNotice || null })
    } catch {}
  }

  useEffect(() => {
    if (open) loadLive()
  }, [open])

  // Off hides it straight away; on brings back its last message.
  const toggleLive = async (key: LiveKey, enabled: boolean) => {
    const current = live[key]
    if (!current) return
    setSavingLive(key)
    setLiveError("")
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value: { ...current, enabled } }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || "Could not update it.")
      setLive(previous => ({ ...previous, [key]: { ...current, enabled } }))
    } catch (err: any) {
      setLiveError(err.message || "Could not update it.")
    } finally {
      setSavingLive(null)
    }
  }

  const includesNotification = channels.includes("notification")
  const includesBanner = channels.includes("banner")
  const includesHomepage = channels.includes("homepage")
  const toggleChannel = (channel: Channel) =>
    setChannels(current => (current.includes(channel) ? current.filter(c => c !== channel) : [...current, channel]))

  const close = () => {
    onOpenChange(false)
    setTimeout(() => {
      setChannels(["notification"])
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
    if (!message.trim() || channels.length === 0) return
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
      formData.append("channels", channels.join(","))
      formData.append("target", target)
      formData.append("title", title)
      formData.append("message", message)
      attachments.forEach((file) => formData.append("attachments", file))

      const res = await fetch("/api/admin/announcements", { method: "POST", body: await stageFormFiles(formData, UPLOAD_LIMITS.announcementAttachments) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || "Unable to send announcement.")
      setResult({ recipientCount: data.recipientCount ?? 0, bannerUpdated: !!data.bannerUpdated })
      loadLive()
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
            {includesNotification && (includesBanner || includesHomepage) && <br />}
            {includesBanner && "Login page banner is now live."}
            {includesBanner && includesHomepage && <br />}
            {includesHomepage && "Homepage public notice is now live."}
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3 pt-2">
            {/* Live now: turn the public banners off/on without sending anything. */}
            <div className="space-y-2 rounded border border-slate-200 dark:border-[#233350] p-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Live now</p>
              {([
                { key: "homepage_notice", label: "Homepage public notice", icon: Globe },
                { key: "login_banner", label: "Login page banner", icon: MonitorSmartphone },
              ] as const).map(item => {
                const setting = live[item.key]
                const hasMessage = !!setting?.message?.trim()
                const Icon = item.icon
                return (
                  <div key={item.key} className="flex items-center gap-3">
                    <Icon className="h-4 w-4 shrink-0 text-blue-600" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold">{item.label}</p>
                      <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                        {!hasMessage
                          ? "Nothing set yet - send an announcement to it below."
                          : `${setting?.enabled ? "On" : "Off"} - "${setting?.title || setting?.message}"`}
                      </p>
                    </div>
                    {savingLive === item.key && <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />}
                    <Switch
                      checked={!!setting?.enabled}
                      onCheckedChange={next => toggleLive(item.key, next)}
                      disabled={!hasMessage || savingLive !== null}
                      aria-label={`${item.label} ${setting?.enabled ? "on" : "off"}`}
                      data-tip={!hasMessage ? "Send an announcement to it first" : setting?.enabled ? "Turn off - hide it now" : "Turn back on with its last message"}
                    />
                  </div>
                )
              })}
              {liveError && <p className="text-[11px] font-semibold text-red-600 dark:text-red-400">{liveError}</p>}
            </div>

            {error && (
              <div className="rounded bg-red-50 dark:bg-red-950/40 p-3 text-sm font-semibold text-red-700 dark:text-red-300">
                {error}
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Deliver as <span className="font-normal text-slate-400">(choose one or more)</span></Label>
              <div className="grid grid-cols-1 gap-2">
                {DELIVERY_OPTIONS.map((option) => {
                  const Icon = option.icon
                  const selected = channels.includes(option.value)
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="checkbox"
                      aria-checked={selected}
                      onClick={() => toggleChannel(option.value)}
                      className={`flex items-center gap-2.5 rounded border-2 px-3 py-2 text-left transition-colors ${
                        selected
                          ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30"
                          : "border-slate-200 dark:border-[#233350] hover:border-slate-300 dark:hover:border-[#2C3E63]"
                      }`}
                    >
                      <Icon className="w-4 h-4 text-blue-600 shrink-0" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-bold">{option.label}</span>
                        <span className="block text-[11px] text-slate-500 dark:text-slate-400">{option.description}</span>
                      </span>
                      <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${selected ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300 dark:border-[#2C3E63]"}`}>
                        {selected && <Check className="h-3 w-3" />}
                      </span>
                    </button>
                  )
                })}
              </div>
              {channels.length === 0 && <p className="text-[11px] font-semibold text-red-600 dark:text-red-400">Choose at least one.</p>}
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
                      className={`rounded border-2 px-2 py-2 text-xs font-bold transition-colors ${
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
                  {(includesBanner || includesHomepage) && " This audience only applies to the notification - banners and the homepage notice show to everyone, signed in or not."}
                </p>
              </div>
            )}

            {(includesNotification || includesHomepage) && (
              <div className="space-y-1">
                <Label htmlFor="announcement-title">Title{!includesNotification && <span className="font-normal text-slate-400"> (optional)</span>}</Label>
                <Input
                  id="announcement-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Scheduled maintenance this weekend"
                  maxLength={200}
                  required={includesNotification}
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
                  className="w-full min-h-32 rounded border border-slate-200 dark:border-[#233350] bg-white dark:bg-[#0B1220] px-3 py-2 pr-11 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
                <MicButton className="top-2 right-2" onText={text => setMessage(m => appendSpeech(m, text))} />
              </div>
              {includesBanner && (
                <p className="text-[11px] text-slate-400">
                  {includesNotification ? "Only the message (not the title) appears on the login page banner." : "Shown as-is on the login page banner."}
                </p>
              )}
              {includesHomepage && (
                <p className="text-[11px] text-slate-400">The homepage notice shows the title (if any) and the message.</p>
              )}
            </div>

            <div className="space-y-1">
              <Label>Attachments (optional)</Label>
              <p className="text-[11px] text-slate-400 -mt-0.5">
                {[
                  includesNotification && "sent with the notification",
                  includesBanner && "shown on the login page banner",
                  includesHomepage && "shown on the homepage notice",
                ].filter(Boolean).join(", ").replace(/^./, c => `Documents or pictures ${c}`) || "Documents or pictures."}
              </p>
              {attachments.map((file, index) => (
                <div key={`${file.name}-${index}`} className="flex items-center justify-between gap-2 rounded border border-slate-200 dark:border-[#233350] bg-slate-50 dark:bg-[#0B1220] px-3 py-2 text-sm">
                  <span className="truncate">{file.name}</span>
                  <button aria-label="Remove" type="button" onClick={() => setAttachments(files => files.filter((_, i) => i !== index))} className="shrink-0 text-slate-400 hover:text-red-500">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <label className="flex items-center gap-2 rounded border border-dashed border-slate-300 dark:border-[#233350] px-3 py-2 text-sm text-slate-500 dark:text-slate-400 cursor-pointer hover:border-blue-400">
                <Paperclip className="w-4 h-4 shrink-0" />
                <span>{attachments.length > 0 ? "Attach another file (max 10MB each)" : "Attach documents or pictures (max 10MB each)"}</span>
                <input
                  type="file"
                  multiple
                  accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx"
                  className="hidden"
                  onChange={(e) => setAttachments(files => [...files, ...Array.from(e.target.files || [])])}
                />
                  <span className="block text-[11px] font-normal text-slate-500 dark:text-slate-400">{describeUploadLimit(UPLOAD_LIMITS.announcementAttachments)}</span>
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
