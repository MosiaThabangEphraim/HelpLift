"use client"

import { useState, type ComponentType } from "react"
import { Bell } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { setReturnTo } from "@/lib/window-return"

// The bell button in the dashboard headers and the Notifications window it
// opens - the same large window (with maximize) as everywhere else, shared by
// the giver, organization and admin dashboards. Each dashboard maps its own
// notifications into `items`.

export type NotificationWindowItem = {
  id: string
  title: string
  subtitle: string
  read: boolean
  /** ISO time, shown as e.g. "2 h ago". */
  createdAt?: string | null
  icon?: ComponentType<{ className?: string }>
  onOpen: () => void
}

function timeAgo(iso: string) {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000))
  if (seconds < 60) return "just now"
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} h ago`
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
}

export function NotificationsWindow({
  items,
  unreadCount,
  buttonTip,
  onMarkAllRead,
  markAllTip = "Mark every notification as read",
  buttonClassName = "rounded",
  dataTour,
}: {
  items: NotificationWindowItem[]
  unreadCount: number
  buttonTip: string
  /** Shown as "Mark all as read" while something is unread. */
  onMarkAllRead?: () => void
  markAllTip?: string
  buttonClassName?: string
  dataTour?: string
}) {
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState<"all" | "unread">("all")
  const shown = filter === "unread" ? items.filter(item => !item.read) : items

  const openItem = (item: NotificationWindowItem) => {
    // Close this window first so the item's own window isn't stacked on top.
    setOpen(false)
    // The window the item opens gets "Back to Notifications".
    setReturnTo("Notifications", () => setOpen(true))
    window.setTimeout(item.onOpen, 120)
  }

  return (
    <>
      <button
        type="button"
        data-tour={dataTour}
        onClick={() => setOpen(true)}
        aria-label="Notifications"
        data-tip={buttonTip}
        className={`relative inline-flex h-9 w-9 items-center justify-center border border-slate-200 dark:border-[#233350] bg-white dark:bg-[#121B2E] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#1A2740] transition-colors ${buttonClassName}`}
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-blue-600" /> Notifications
            </DialogTitle>
            <DialogDescription>
              {unreadCount > 0 ? `${unreadCount} unread` : "You're all caught up."}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1 rounded border border-slate-200 dark:border-[#233350] p-1">
              {(["all", "unread"] as const).map(option => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setFilter(option)}
                  aria-pressed={filter === option}
                  className={`rounded px-3 py-1 text-xs font-bold capitalize transition-colors ${filter === option ? "bg-blue-600 text-white" : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#1A2740]"}`}
                >
                  {option}
                </button>
              ))}
            </div>
            {onMarkAllRead && unreadCount > 0 && (
              <button type="button" onClick={onMarkAllRead} data-tip={markAllTip} className="text-xs font-bold text-blue-600 hover:underline">
                Mark all as read
              </button>
            )}
          </div>

          {shown.length === 0 ? (
            <p className="rounded border border-dashed border-slate-300 dark:border-[#233350] p-8 text-center text-sm text-slate-500 dark:text-slate-400">
              {filter === "unread" ? "No unread notifications." : "No notifications yet."}
            </p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-[#233350] rounded border border-slate-200 dark:border-[#233350]">
              {shown.map(item => {
                const Icon = item.icon
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => openItem(item)}
                      className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 dark:hover:bg-[#1A2740] ${!item.read ? "bg-blue-50/70 dark:bg-blue-950/30" : ""}`}
                    >
                      {Icon ? (
                        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                      ) : (
                        <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${item.read ? "bg-transparent" : "bg-blue-600"}`} />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className={`block text-sm ${item.read ? "font-semibold" : "font-bold"}`}>{item.title}</span>
                        <span className="mt-0.5 block whitespace-pre-line text-sm text-slate-600 dark:text-slate-300">{item.subtitle}</span>
                      </span>
                      {item.createdAt && (
                        <time dateTime={item.createdAt} title={new Date(item.createdAt).toLocaleString()} className="shrink-0 text-xs text-slate-400">
                          {timeAgo(item.createdAt)}
                        </time>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
