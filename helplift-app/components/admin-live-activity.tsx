"use client"

import { useCallback, useEffect, useState } from "react"
import { ArrowLeft, Eye, Loader2, MousePointerClick, Trash2, X } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { RefreshButton } from "@/components/refresh-button"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

// Admin Live activity tab: who's online right now and what signed-in users
// are doing - pages opened and key actions - from app/api/admin/activity.
// Polls every 10 seconds while the tab is open and visible. Click anyone to
// see their own timeline. Filter by kind, role and a date/time range; "Clear
// log" empties the whole history (the clearing itself is logged).

type ProfileInfo = { full_name: string | null; email: string | null; role: string | null }
type Event = {
  id: string
  created_at: string
  profile_id: string
  role: string | null
  kind: "page_view" | "action"
  action: string | null
  path: string | null
  detail: string | null
  profiles: ProfileInfo | ProfileInfo[] | null
}
type Presence = { profile_id: string; last_seen_at: string; path: string | null; profiles: ProfileInfo | ProfileInfo[] | null }

const POLL_MS = 10_000

const PAGE_NAMES: Record<string, string> = {
  "/": "Homepage",
  "/givers-dashboard": "Giver dashboard",
  "/organisation-dashboard": "Organization dashboard",
  "/admin-dashboard": "Admin dashboard",
  "/needs": "Needs board",
  "/gift-library": "Gift Library",
  "/organizations": "Organizations directory",
  "/profile": "Profile",
  "/pending-verification": "Pending verification",
  "/suspended": "Suspended page",
  "/developers": "Developers page",
  "/privacy": "Privacy Policy",
  "/terms": "Terms of Service",
}

function pageName(path: string | null) {
  if (!path) return "a page"
  if (PAGE_NAMES[path]) return PAGE_NAMES[path]
  if (path.startsWith("/organizations/")) return "an organization's profile"
  return path
}

function who(profiles: Event["profiles"]) {
  return Array.isArray(profiles) ? profiles[0] : profiles
}

function timeAgo(iso: string) {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000))
  if (seconds < 60) return "just now"
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} h ago`
  return new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
}

const ROLE_CLASS: Record<string, string> = {
  giver: "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300",
  organization: "bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300",
  admin: "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900",
}

function RoleTag({ role }: { role: string | null | undefined }) {
  if (!role) return null
  return <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${ROLE_CLASS[role] || "bg-slate-100 text-slate-600"}`}>{role === "organization" ? "org" : role}</span>
}

const chipClass = (active: boolean) =>
  `rounded px-3 py-1.5 text-xs font-bold transition-colors ${active ? "bg-blue-600 text-white" : "bg-slate-100 dark:bg-[#1A2740] text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-[#233350]"}`

export function AdminLiveActivity({ refreshKey = 0 }: { refreshKey?: number }) {
  // refreshKey: bumped by the dashboard's refresh button to re-fetch in place (filters are kept).
  const [events, setEvents] = useState<Event[] | null>(null)
  const [online, setOnline] = useState<Presence[]>([])
  const [error, setError] = useState("")
  const [kind, setKind] = useState<"all" | "action" | "page_view">("all")
  const [role, setRole] = useState("all")
  const [person, setPerson] = useState<{ id: string; name: string } | null>(null)
  // True only while a filter change the admin made is loading (not during
  // the quiet background refresh every 10 seconds).
  const [isFiltering, setIsFiltering] = useState(false)
  // Date/time range, as <input type="datetime-local"> values (local time).
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [confirmClear, setConfirmClear] = useState(false)
  const [isClearing, setIsClearing] = useState(false)
  const [notice, setNotice] = useState("")

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ kind, role })
      if (person) params.set("profile", person.id)
      // datetime-local has no time zone; new Date() reads it as local time.
      if (from) params.set("from", new Date(from).toISOString())
      if (to) params.set("to", new Date(to).toISOString())
      const res = await fetch(`/api/admin/activity?${params}`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || "Could not load activity.")
      setEvents(data.events || [])
      setOnline(data.online || [])
      setError("")
    } catch (err: any) {
      setError(err.message || "Could not load activity.")
      setEvents(current => current ?? [])
    } finally {
      setIsFiltering(false)
    }
  }, [kind, role, person, from, to])

  const changeRange = (which: "from" | "to", value: string) => {
    setIsFiltering(true)
    if (which === "from") setFrom(value)
    else setTo(value)
  }

  const clearLog = async () => {
    setIsClearing(true)
    setError("")
    try {
      const res = await fetch("/api/admin/activity", { method: "DELETE" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || "Could not clear the activity log.")
      setNotice(`Cleared ${data.removed ?? 0} ${data.removed === 1 ? "entry" : "entries"}.`)
      await load()
    } catch (err: any) {
      setError(err.message || "Could not clear the activity log.")
    } finally {
      setIsClearing(false)
      setConfirmClear(false)
    }
  }

  useEffect(() => {
    load()
    const interval = window.setInterval(() => { if (document.visibilityState === "visible") load() }, POLL_MS)
    return () => window.clearInterval(interval)
  }, [load, refreshKey])

  const openPerson = (profileId: string, profiles: Event["profiles"]) => {
    const info = who(profiles)
    setEvents(null)
    setPerson({ id: profileId, name: info?.full_name || info?.email || "This user" })
  }

  return (
    <div className="grid gap-x-10 gap-y-8 lg:grid-cols-[minmax(0,1fr)_280px]">
      <Card>
        <CardHeader className="flex-row flex-wrap items-start justify-between gap-3 space-y-0">
          <div>
            {person ? (
              <>
                <button type="button" onClick={() => { setEvents(null); setPerson(null) }} className="mb-1 inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:underline">
                  <ArrowLeft className="h-3.5 w-3.5" /> All activity
                </button>
                <CardTitle>{person.name}&apos;s activity</CardTitle>
              </>
            ) : (
              <CardTitle className="flex items-center gap-2">
                Live activity
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
              </CardTitle>
            )}
            <CardDescription>Pages opened and actions taken by signed-in users. Updates every 10 seconds; kept for 90 days.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {!person && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => { setNotice(""); setConfirmClear(true) }}
                disabled={isClearing || !events?.length}
                data-tip="Delete all live activity"
                className="text-red-600 hover:text-red-700 dark:text-red-400"
              >
                {isClearing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                Clear log
              </Button>
            )}
            <RefreshButton onRefresh={load} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {(["all", "action", "page_view"] as const).map(value => (
              <button
                key={value}
                type="button"
                onClick={() => { if (kind !== value) { setIsFiltering(true); setKind(value) } }}
                aria-pressed={kind === value}
                className={`inline-flex items-center gap-1.5 ${chipClass(kind === value)}`}
              >
                {isFiltering && kind === value && <Loader2 className="h-3 w-3 animate-spin" />}
                {value === "all" ? "Everything" : value === "action" ? "Actions" : "Page views"}
              </button>
            ))}
            {!person && (
              <select value={role} onChange={e => { setIsFiltering(true); setRole(e.target.value) }} disabled={isFiltering} aria-label="Role" className="disabled:opacity-60 rounded border border-slate-200 dark:border-[#233350] bg-white dark:bg-[#0B1220] px-2.5 py-1.5 text-xs font-semibold">
                <option value="all">All roles</option>
                <option value="giver">Givers</option>
                <option value="organization">Organizations</option>
                <option value="admin">Admins</option>
              </select>
            )}
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
              <label className="flex items-center gap-1.5">
                From
                <input
                  type="datetime-local"
                  value={from}
                  max={to || undefined}
                  onChange={e => changeRange("from", e.target.value)}
                  aria-label="From date and time"
                  className="rounded border border-slate-200 dark:border-[#233350] bg-white dark:bg-[#0B1220] px-2 py-1 text-xs text-slate-700 dark:text-slate-200"
                />
              </label>
              <label className="flex items-center gap-1.5">
                To
                <input
                  type="datetime-local"
                  value={to}
                  min={from || undefined}
                  onChange={e => changeRange("to", e.target.value)}
                  aria-label="To date and time"
                  className="rounded border border-slate-200 dark:border-[#233350] bg-white dark:bg-[#0B1220] px-2 py-1 text-xs text-slate-700 dark:text-slate-200"
                />
              </label>
              {(from || to) && (
                <button
                  type="button"
                  onClick={() => { setIsFiltering(true); setFrom(""); setTo("") }}
                  className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-bold text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                >
                  <X className="h-3 w-3" /> Any time
                </button>
              )}
            </div>
            {isFiltering && (
              <span role="status" className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading...
              </span>
            )}
          </div>

          {error && <p className="text-sm font-semibold text-red-600 dark:text-red-400">{error} (Has the 20261006000200_activity_tracking.sql migration been applied?)</p>}
          {notice && <p role="status" className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">{notice}</p>}

          {events === null ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-blue-600" /></div>
          ) : events.length === 0 ? (
            <p className="rounded border border-dashed border-slate-300 dark:border-[#233350] p-6 text-center text-sm text-slate-500 dark:text-slate-400">{from || to ? "No activity in this date and time range." : "No activity yet."}</p>
          ) : (
            <ul aria-busy={isFiltering} className={`divide-y divide-slate-100 dark:divide-[#233350] rounded border border-slate-200 dark:border-[#233350] transition-opacity ${isFiltering ? "opacity-50" : ""}`}>
              {events.map(event => {
                const info = who(event.profiles)
                const isAction = event.kind === "action"
                return (
                  <li key={event.id} className="flex items-start gap-3 px-3 py-2.5 text-sm">
                    <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded ${isAction ? "bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-300" : "bg-slate-100 text-slate-500 dark:bg-[#1A2740] dark:text-slate-400"}`}>
                      {isAction ? <MousePointerClick className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-1.5">
                        {person ? null : (
                          <button type="button" onClick={() => openPerson(event.profile_id, event.profiles)} className="font-semibold text-slate-900 dark:text-slate-100 hover:underline">
                            {info?.full_name || info?.email || "A user"}
                          </button>
                        )}
                        {!person && <RoleTag role={event.role || info?.role} />}
                        <span className="text-slate-600 dark:text-slate-300">
                          {isAction ? event.action : `opened ${pageName(event.path)}`}
                        </span>
                      </span>
                      {(event.detail || (isAction && event.path)) && (
                        <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{event.detail || pageName(event.path)}</span>
                      )}
                    </span>
                    <time dateTime={event.created_at} className="shrink-0 text-xs text-slate-400" title={new Date(event.created_at).toLocaleString()}>{timeAgo(event.created_at)}</time>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Online now ({online.length})</CardTitle>
          <CardDescription>Active in the last few minutes.</CardDescription>
        </CardHeader>
        <CardContent>
          {online.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">Nobody is online right now.</p>
          ) : (
            <ul className="space-y-2.5">
              {online.map(entry => {
                const info = who(entry.profiles)
                return (
                  <li key={entry.profile_id}>
                    <button type="button" onClick={() => openPerson(entry.profile_id, entry.profiles)} className="flex w-full items-start gap-2 text-left">
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100 hover:underline">{info?.full_name || info?.email || "A user"}</span>
                          <RoleTag role={info?.role} />
                        </span>
                        <span className="block truncate text-xs text-slate-500 dark:text-slate-400">On {pageName(entry.path)} · {timeAgo(entry.last_seen_at)}</span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={confirmClear} onOpenChange={open => { if (!isClearing) setConfirmClear(open) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear all live activity?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes every page view and action in the log, for all users, not just the ones shown by the current filters. It can&apos;t be undone. Who&apos;s online now isn&apos;t affected, and the clearing itself will be logged.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isClearing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={e => { e.preventDefault(); clearLog() }}
              disabled={isClearing}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {isClearing && <Loader2 className="h-4 w-4 animate-spin" />}
              Clear everything
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
