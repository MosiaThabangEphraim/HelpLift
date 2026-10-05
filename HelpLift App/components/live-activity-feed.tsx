"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { BookOpen, CheckCircle2, Gift, Hand, Heart, Megaphone, ShieldCheck, type LucideIcon } from "lucide-react"
import { OrgLogo } from "@/components/org-logo"

// Homepage "live" feed of recent, anonymised platform activity from
// /api/public/activity. Refreshes every minute while the tab is visible.

type ActivityType = "donation" | "interest" | "need_posted" | "need_fulfilled" | "organization_joined" | "story" | "gift"
type ActivityItem = { id: string; type: ActivityType; text: string; at: string; href?: string; org?: { name: string; logo: string | null } }

const REFRESH_MS = 60_000

const TYPE_STYLES: Record<ActivityType, { icon: LucideIcon; className: string }> = {
  donation: { icon: Heart, className: "bg-rose-50 text-rose-600 dark:bg-rose-950 dark:text-rose-400" },
  interest: { icon: Hand, className: "bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400" },
  need_posted: { icon: Megaphone, className: "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400" },
  need_fulfilled: { icon: CheckCircle2, className: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400" },
  organization_joined: { icon: ShieldCheck, className: "bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400" },
  story: { icon: BookOpen, className: "bg-purple-50 text-purple-600 dark:bg-purple-950 dark:text-purple-400" },
  gift: { icon: Gift, className: "bg-teal-50 text-teal-600 dark:bg-teal-950 dark:text-teal-400" },
}

function timeAgo(iso: string, now: number) {
  const seconds = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000))
  if (seconds < 60) return "just now"
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`
  const days = Math.round(hours / 24)
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
}

export function LiveActivityFeed() {
  const [items, setItems] = useState<ActivityItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    let cancelled = false
    const load = () => {
      fetch("/api/public/activity")
        .then(res => res.json())
        .then(data => {
          if (cancelled || !data.success || !Array.isArray(data.activity)) return
          setItems(data.activity)
          setNow(Date.now())
        })
        .catch(() => {})
        .finally(() => { if (!cancelled) setIsLoading(false) })
    }

    load()
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") load()
    }, REFRESH_MS)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  return (
    <div className="flex flex-col h-[380px] md:h-[440px] rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
        <h3 className="font-bold text-slate-900 dark:text-slate-100">Live activity</h3>
        <span className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          Live
        </span>
      </div>

      <ul aria-live="polite" className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
        {isLoading ? (
          [0, 1, 2, 3, 4].map(i => (
            <li key={i} className="flex items-start gap-3 px-5 py-3.5">
              <div className="h-8 w-8 rounded-full bg-slate-100 dark:bg-slate-800 animate-pulse shrink-0" />
              <div className="flex-1 space-y-2 pt-1">
                <div className="h-3 rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
                <div className="h-2.5 w-16 rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
              </div>
            </li>
          ))
        ) : items.length === 0 ? (
          <li className="px-5 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
            No activity yet - be the first to make a difference.
          </li>
        ) : (
          items.map(item => {
            const { icon: Icon, className } = TYPE_STYLES[item.type] ?? TYPE_STYLES.need_posted
            const body = (
              <>
                {item.org ? (
                  // Organization events show who it was; anonymous ones keep their type icon.
                  <OrgLogo src={item.org.logo} name={item.org.name} className="h-8 w-8 rounded-full" />
                ) : (
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${className}`}>
                    <Icon className="h-4 w-4" />
                  </span>
                )}
                <span className="min-w-0">
                  <span className="block text-sm leading-snug text-slate-700 dark:text-slate-200">{item.text}</span>
                  <time dateTime={item.at} className="block mt-0.5 text-xs text-slate-400 dark:text-slate-500">{timeAgo(item.at, now)}</time>
                </span>
              </>
            )
            return (
              <li key={item.id} className="animate-in fade-in duration-500">
                {item.href ? (
                  <Link href={item.href} className="flex items-start gap-3 px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors">
                    {body}
                  </Link>
                ) : (
                  <div className="flex items-start gap-3 px-5 py-3.5">{body}</div>
                )}
              </li>
            )
          })
        )}
      </ul>
    </div>
  )
}
