"use client"

import { useCallback, useEffect, useState } from "react"
import { CheckCircle2, Clock, Loader2 } from "lucide-react"
import { MessageDetailDialog, type MessageDetail } from "@/components/message-detail-dialog"

type SentItem = {
  id: string
  recipient_name: string
  recipient_role: string | null
  message: string
  created_at: string
  replied: boolean
}

// "Sent" view of the Messages tab: the conversations the user has sent messages
// in. Opening one shows the whole conversation and lets them keep replying.
// Used by the giver, organization and admin dashboards.
export function SentMessages({ canReply = true }: { canReply?: boolean }) {
  const [items, setItems] = useState<SentItem[] | null>(null)
  const [error, setError] = useState("")
  const [open, setOpen] = useState<MessageDetail | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/messages/sent")
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || "Could not load sent messages.")
      setItems(data.items || [])
      setError("")
    } catch (err: any) {
      setError(err.message || "Could not load sent messages.")
      setItems(current => current ?? [])
    }
  }, [])

  useEffect(() => { load() }, [load])

  if (items === null) {
    return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-blue-600" /></div>
  }

  return (
    <div className="space-y-3">
      {error && <p className="rounded-xl bg-red-50 dark:bg-red-950/40 p-3 text-xs font-semibold text-red-700 dark:text-red-300">{error}</p>}
      {items.length === 0 && !error ? (
        <p className="rounded-2xl border border-dashed border-slate-300 dark:border-[#233350] p-6 text-center text-sm text-slate-500 dark:text-slate-400">
          You haven't sent any messages yet.
        </p>
      ) : (
        items.map(item => (
          <div
            key={item.id}
            role="button"
            tabIndex={0}
            onClick={() => setOpen({
              id: item.id,
              title: `Conversation with ${item.recipient_name}`,
              message: item.message,
              // Marked as a direct message so the conversation loads, but with no
              // sender_id so it never offers to "reply" to your own message.
              type: "org_message",
              sender_id: null,
              sender_name: "You",
              created_at: item.created_at,
            })}
            onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.currentTarget.click() } }}
            className="w-full cursor-pointer rounded-2xl border border-slate-200 dark:border-[#233350] p-4 text-left hover:border-blue-300 dark:hover:border-blue-800"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="font-bold text-sm">To: {item.recipient_name}</p>
              <span className="shrink-0 text-[11px] text-slate-400">{new Date(item.created_at).toLocaleString()}</span>
            </div>
            <p className="mt-1 truncate text-sm text-slate-600 dark:text-slate-300">You: {item.message}</p>
            <span className={`mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${
              item.replied
                ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
                : "bg-slate-100 dark:bg-[#1A2740] text-slate-500 dark:text-slate-400"
            }`}>
              {item.replied ? <><CheckCircle2 className="h-3 w-3" /> Replied</> : <><Clock className="h-3 w-3" /> Awaiting reply</>}
            </span>
          </div>
        ))
      )}

      <MessageDetailDialog
        open={!!open}
        onOpenChange={next => { if (!next) { setOpen(null); load() } }}
        message={open}
        canReply={canReply}
      />
    </div>
  )
}

// The Inbox | Sent switch shown above the message list.
export function MessageViewToggle({ value, onChange }: { value: "inbox" | "sent"; onChange: (value: "inbox" | "sent") => void }) {
  return (
    <div className="flex items-center gap-2" role="group" aria-label="Message view">
      {(["inbox", "sent"] as const).map(option => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          aria-pressed={value === option}
          className={`rounded-full px-4 py-1.5 text-xs font-bold capitalize transition-colors ${
            value === option
              ? "bg-blue-600 text-white"
              : "bg-slate-100 dark:bg-[#1A2740] text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-[#233350]"
          }`}
        >
          {option}
        </button>
      ))}
    </div>
  )
}
