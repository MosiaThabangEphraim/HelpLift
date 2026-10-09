"use client"

import { useCallback, useEffect, useState } from "react"
import { AlertTriangle, Download, Loader2, Search, Trash2, X } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { StatTile } from "@/components/analytics/chart-parts"
import { RefreshButton } from "@/components/refresh-button"
import { downloadCsv, toCsv } from "@/lib/csv"
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

// Admin Security tab: every sign-in attempt (successful or not) across all
// methods and both portals - from app/api/admin/login-attempts.

type Attempt = {
  id: string
  created_at: string
  email: string | null
  profile_id: string | null
  outcome: string
  method: string
  portal: string
  ip_address: string | null
  country: string | null
  city: string | null
  device: string | null
  user_agent: string | null
  detail: string | null
  profiles: { full_name: string | null; role: string | null } | { full_name: string | null; role: string | null }[] | null
}
type Summary = {
  successes: number
  failures: number
  lockouts: number
  suspiciousIps: { value: string; count: number }[]
  targetedAccounts: { value: string; count: number }[]
}

const OUTCOMES: Record<string, { label: string; tone: "good" | "bad" | "warn" | "info" }> = {
  success: { label: "Signed in", tone: "good" },
  two_factor_passed: { label: "Signed in (2FA)", tone: "good" },
  two_factor_sent: { label: "2FA code sent", tone: "info" },
  wrong_password: { label: "Wrong password", tone: "bad" },
  unknown_account: { label: "Unknown email", tone: "bad" },
  two_factor_failed: { label: "Wrong 2FA code", tone: "bad" },
  locked: { label: "Blocked - locked", tone: "warn" },
  account_locked_now: { label: "Account locked", tone: "warn" },
  unlocked: { label: "Unlocked", tone: "info" },
  unlock_failed: { label: "Wrong unlock code", tone: "bad" },
  wrong_portal: { label: "Wrong portal", tone: "warn" },
  error: { label: "Error", tone: "bad" },
}
const TONE_CLASS = {
  good: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
  bad: "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300",
  warn: "bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
  info: "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300",
}
const METHOD_LABELS: Record<string, string> = { password: "Password", google: "Google", microsoft: "Microsoft", linkedin: "LinkedIn", passkey: "Passkey", other: "Other" }

function profileOf(attempt: Attempt) {
  return Array.isArray(attempt.profiles) ? attempt.profiles[0] : attempt.profiles
}

function location(attempt: Attempt) {
  return [attempt.city, attempt.country].filter(Boolean).join(", ") || "Unknown"
}

const formatTime = (iso: string) => new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit" })

const chipClass = (active: boolean) =>
  `rounded px-3 py-1.5 text-xs font-bold transition-colors ${active ? "bg-blue-600 text-white" : "bg-slate-100 dark:bg-[#1A2740] text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-[#233350]"}`

export function AdminLoginActivity({ refreshKey = 0 }: { refreshKey?: number }) {
  // refreshKey: bumped by the dashboard's refresh button to re-fetch in place (filters are kept).
  const [attempts, setAttempts] = useState<Attempt[] | null>(null)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [error, setError] = useState("")
  const [result, setResult] = useState<"all" | "failed" | "success">("all")
  const [days, setDays] = useState("7")
  const [search, setSearch] = useState("")
  const [query, setQuery] = useState("")
  // An exact date/time range (datetime-local values); when set it replaces "Last N days".
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [confirmClear, setConfirmClear] = useState(false)
  const [isClearing, setIsClearing] = useState(false)
  const [notice, setNotice] = useState("")
  // True while a filter change (or refresh) is fetching - shown on the chosen
  // filter and by dimming the table, so it's clear the click registered.
  const [isLoading, setIsLoading] = useState(true)

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({ result, days, q: query })
      if (from) params.set("from", new Date(from).toISOString())
      if (to) params.set("to", new Date(to).toISOString())
      const res = await fetch(`/api/admin/login-attempts?${params}`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || "Could not load login activity.")
      setAttempts(data.attempts || [])
      setSummary(data.summary || null)
      setError("")
    } catch (err: any) {
      setError(err.message || "Could not load login activity.")
      setAttempts(current => current ?? [])
    } finally {
      setIsLoading(false)
    }
  }, [result, days, query, from, to])

  const clearLog = async () => {
    setIsClearing(true)
    setError("")
    try {
      const res = await fetch("/api/admin/login-attempts", { method: "DELETE" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || "Could not clear the login history.")
      setNotice(`Cleared ${data.removed ?? 0} ${data.removed === 1 ? "entry" : "entries"}.`)
      await load()
    } catch (err: any) {
      setError(err.message || "Could not clear the login history.")
    } finally {
      setIsClearing(false)
      setConfirmClear(false)
    }
  }

  useEffect(() => { load() }, [load, refreshKey])

  // Search as you type, without a request per keystroke.
  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(search.trim()), 400)
    return () => window.clearTimeout(timer)
  }, [search])

  const exportCsv = () => {
    const csv = toCsv(attempts || [], [
      { header: "Time", value: a => new Date(a.created_at).toISOString() },
      { header: "Result", value: a => OUTCOMES[a.outcome]?.label || a.outcome },
      { header: "Email", value: a => a.email },
      { header: "Name", value: a => profileOf(a)?.full_name },
      { header: "Role", value: a => profileOf(a)?.role },
      { header: "Method", value: a => METHOD_LABELS[a.method] || a.method },
      { header: "Portal", value: a => a.portal },
      { header: "IP address", value: a => a.ip_address },
      { header: "Location", value: a => location(a) },
      { header: "Device", value: a => a.device },
      { header: "Details", value: a => a.detail },
      { header: "User agent", value: a => a.user_agent },
    ])
    downloadCsv(`helplift-login-activity-${new Date().toISOString().slice(0, 10)}.csv`, csv)
  }

  const flagged = [...(summary?.suspiciousIps || []).map(item => ({ ...item, kind: "IP address" })), ...(summary?.targetedAccounts || []).map(item => ({ ...item, kind: "Account" }))]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-x-6 gap-y-5 md:grid-cols-4">
        <StatTile label="Successful sign-ins" value={summary?.successes ?? "-"} note="Last 24 hours" />
        <StatTile label="Failed attempts" value={summary?.failures ?? "-"} note="Last 24 hours" />
        <StatTile label="Accounts locked" value={summary?.lockouts ?? "-"} note="Last 24 hours" />
        <StatTile label="Suspicious IPs" value={summary?.suspiciousIps.length ?? "-"} note="3+ failures in 24 hours" />
      </div>

      {flagged.length > 0 && (
        <div role="status" className="rounded border border-amber-300 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-950/30 p-4 space-y-2">
          <p className="flex items-center gap-2 text-sm font-bold text-amber-800 dark:text-amber-300">
            <AlertTriangle className="h-4 w-4 shrink-0" /> Worth a closer look (last 24 hours)
          </p>
          <ul className="space-y-1 text-xs text-amber-900 dark:text-amber-200">
            {flagged.map(item => (
              <li key={`${item.kind}-${item.value}`}>
                <button type="button" onClick={() => { setSearch(item.value); setResult("failed") }} className="font-semibold hover:underline">
                  {item.kind}: {item.value}
                </button>{" "}
                - {item.count} failed attempts
              </li>
            ))}
          </ul>
        </div>
      )}

      <Card>
        <CardHeader className="flex-row flex-wrap items-start justify-between gap-3 space-y-0">
          <div>
            <CardTitle>Login activity</CardTitle>
            <CardDescription>Every sign-in attempt - password, Google, Microsoft, LinkedIn and passkeys, on both portals. Kept for 90 days.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => { setNotice(""); setConfirmClear(true) }}
              disabled={isClearing || !attempts?.length}
              data-tip="Delete the whole login history"
              className="btn-delete btn-delete--label h-9"
            >
              {isClearing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Clear log
            </button>
            <RefreshButton onRefresh={load} />
            <button
              type="button"
              onClick={exportCsv}
              disabled={!attempts?.length}
              className="inline-flex items-center gap-1.5 btn-pill btn-pill--neutral disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5" /> Export CSV
            </button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {(["all", "failed", "success"] as const).map(value => (
              <button key={value} type="button" onClick={() => setResult(value)} aria-pressed={result === value} className={`inline-flex items-center gap-1.5 ${chipClass(result === value)}`}>
                {isLoading && result === value && <Loader2 className="h-3 w-3 animate-spin" />}
                {value === "all" ? "All" : value === "failed" ? "Failed" : "Successful"}
              </button>
            ))}
            <select value={days} onChange={e => setDays(e.target.value)} disabled={isLoading || !!from || !!to} aria-label="Time period" data-tip={from || to ? "Using the From/To range instead" : undefined} className="disabled:opacity-60 rounded border border-slate-200 dark:border-[#233350] bg-white dark:bg-[#0B1220] px-2.5 py-1.5 text-xs font-semibold">
              <option value="1">Last 24 hours</option>
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
            </select>
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
              <label className="flex items-center gap-1.5">
                From
                <input
                  type="datetime-local"
                  value={from}
                  max={to || undefined}
                  onChange={e => setFrom(e.target.value)}
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
                  onChange={e => setTo(e.target.value)}
                  aria-label="To date and time"
                  className="rounded border border-slate-200 dark:border-[#233350] bg-white dark:bg-[#0B1220] px-2 py-1 text-xs text-slate-700 dark:text-slate-200"
                />
              </label>
              {(from || to) && (
                <button
                  type="button"
                  onClick={() => { setFrom(""); setTo("") }}
                  className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-bold text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                >
                  <X className="h-3 w-3" /> Clear dates
                </button>
              )}
            </div>
            {isLoading && attempts !== null && (
              <span role="status" className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading...
              </span>
            )}
            <div className="relative ml-auto w-full sm:w-64">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search email or IP address"
                className="w-full rounded border border-slate-200 dark:border-[#233350] bg-white dark:bg-[#0B1220] py-1.5 pl-8 pr-3 text-xs"
              />
            </div>
          </div>

          {error && <p className="text-sm font-semibold text-red-600 dark:text-red-400">{error}</p>}
          {notice && <p role="status" className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">{notice}</p>}

          {attempts === null || (isLoading && attempts.length === 0) ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-blue-600" /></div>
          ) : attempts.length === 0 ? (
            <p className="rounded border border-dashed border-slate-300 dark:border-[#233350] p-6 text-center text-sm text-slate-500 dark:text-slate-400">No sign-in attempts match these filters.</p>
          ) : (
            <div className={`overflow-x-auto rounded border border-slate-200 dark:border-[#233350] transition-opacity ${isLoading ? "opacity-50" : ""}`} aria-busy={isLoading}>
              <table className="w-full min-w-[900px] text-xs">
                <thead className="bg-slate-50 dark:bg-[#0B1220] text-left text-slate-500">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Time</th>
                    <th className="px-3 py-2 font-semibold">Result</th>
                    <th className="px-3 py-2 font-semibold">Account</th>
                    <th className="px-3 py-2 font-semibold">Method</th>
                    <th className="px-3 py-2 font-semibold">IP and location</th>
                    <th className="px-3 py-2 font-semibold">Device</th>
                    <th className="px-3 py-2 font-semibold">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {attempts.map(attempt => {
                    const outcome = OUTCOMES[attempt.outcome] || { label: attempt.outcome, tone: "info" as const }
                    const profile = profileOf(attempt)
                    return (
                      <tr key={attempt.id} className="border-t border-slate-100 dark:border-[#233350] align-top">
                        <td className="px-3 py-2 whitespace-nowrap text-slate-600 dark:text-slate-300">{formatTime(attempt.created_at)}</td>
                        <td className="px-3 py-2">
                          <span className={`inline-block rounded px-2 py-0.5 font-bold whitespace-nowrap ${TONE_CLASS[outcome.tone]}`}>{outcome.label}</span>
                        </td>
                        <td className="px-3 py-2">
                          <span className="block font-semibold text-slate-900 dark:text-slate-100">{profile?.full_name || attempt.email || "Unknown"}</span>
                          <span className="block text-slate-500 dark:text-slate-400">
                            {profile?.full_name ? attempt.email : ""}{profile?.role ? `${profile?.full_name ? " · " : ""}${profile.role}` : ""}
                          </span>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {METHOD_LABELS[attempt.method] || attempt.method}
                          {attempt.portal === "admin" && <span className="ml-1.5 rounded bg-slate-900 dark:bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-white dark:text-slate-900">ADMIN</span>}
                        </td>
                        <td className="px-3 py-2">
                          <button type="button" onClick={() => setSearch(attempt.ip_address || "")} className="block font-mono text-slate-700 dark:text-slate-300 hover:underline" data-tip="Show every attempt from this IP">
                            {attempt.ip_address || "Unknown"}
                          </button>
                          <span className="block text-slate-500 dark:text-slate-400">{location(attempt)}</span>
                        </td>
                        <td className="px-3 py-2 text-slate-600 dark:text-slate-300" title={attempt.user_agent || undefined}>{attempt.device || "Unknown"}</td>
                        <td className="px-3 py-2 text-slate-500 dark:text-slate-400">{attempt.detail || "-"}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
      <AlertDialog open={confirmClear} onOpenChange={open => { if (!isClearing) setConfirmClear(open) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear the whole login history?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes every sign-in attempt in the log, not just the ones shown by the current filters. It can&apos;t be undone, and the clearing itself will be recorded in Live activity.
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
