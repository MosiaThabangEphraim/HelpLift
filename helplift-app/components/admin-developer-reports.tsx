"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { AdminDeleteButton } from "@/components/admin-delete-button"
import { Bug, ExternalLink, Lightbulb, Loader2, Mail, Paperclip, Send, ShieldAlert, Wrench } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { StatTile } from "@/components/analytics/chart-parts"
import { RefreshButton } from "@/components/refresh-button"
import { describeDevice } from "@/lib/request-info"

// Admin Dev reports tab: anonymous bug reports, improvement ideas and
// security reports from the public /developers page, with their proof files
// and a status/notes workflow (app/api/admin/developer-reports).

type Attachment = { name: string; type: string; size: number; url: string | null }
type Report = {
  id: string
  created_at: string
  report_type: "bug" | "improvement" | "security" | "other"
  title: string
  description: string
  steps_to_reproduce: string | null
  page_url: string | null
  severity: "low" | "medium" | "high" | "critical" | null
  contact_email: string | null
  user_agent: string | null
  attachments: Attachment[]
  status: "new" | "reviewing" | "planned" | "fixed" | "dismissed"
  admin_notes: string | null
}

const TYPE_INFO = {
  bug: { label: "Bug", icon: Bug, className: "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300" },
  improvement: { label: "Improvement", icon: Lightbulb, className: "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300" },
  security: { label: "Security", icon: ShieldAlert, className: "bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300" },
  other: { label: "Other", icon: Wrench, className: "bg-slate-100 text-slate-700 dark:bg-[#1A2740] dark:text-slate-300" },
}
const STATUSES: { value: Report["status"]; label: string }[] = [
  { value: "new", label: "New" },
  { value: "reviewing", label: "Reviewing" },
  { value: "planned", label: "Planned" },
  { value: "fixed", label: "Fixed" },
  { value: "dismissed", label: "Dismissed" },
]
const SEVERITY_CLASS: Record<string, string> = {
  critical: "text-red-700 dark:text-red-300",
  high: "text-orange-700 dark:text-orange-300",
  medium: "text-amber-700 dark:text-amber-300",
  low: "text-slate-500 dark:text-slate-400",
}

const chipClass = (active: boolean) =>
  `rounded px-3 py-1.5 text-xs font-bold transition-colors ${active ? "bg-blue-600 text-white" : "bg-slate-100 dark:bg-[#1A2740] text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-[#233350]"}`

// Emails the sender (through Brevo, app/api/admin/developer-reports/[id]/reply).
// Only shown when they chose to leave a contact email.
function ReplyByEmail({ report, onSent }: { report: Report; onSent: (adminNotes: string) => void }) {
  const [open, setOpen] = useState(false)
  const [subject, setSubject] = useState(`Re: your HelpLift report "${report.title}"`)
  const [message, setMessage] = useState("")
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null)

  const send = async () => {
    setSending(true)
    setResult(null)
    try {
      const res = await fetch(`/api/admin/developer-reports/${report.id}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, message }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || "The reply couldn't be sent.")
      setResult({ ok: true, text: data.message || "Reply sent." })
      setMessage("")
      setOpen(false)
      if (data.admin_notes) onSent(data.admin_notes)
    } catch (err: any) {
      setResult({ ok: false, text: err.message || "The reply couldn't be sent." })
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-2">
      {!open ? (
        <button
          type="button"
          onClick={() => { setOpen(true); setResult(null) }}
          className="inline-flex items-center gap-1.5 btn-pill btn-pill--neutral"
        >
          <Mail className="h-3.5 w-3.5" /> Reply by email
        </button>
      ) : (
        <div className="space-y-2 rounded border border-slate-200 dark:border-[#233350] p-3">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            To <strong className="text-slate-700 dark:text-slate-200">{report.contact_email}</strong> - sent from HelpLift; their reply comes back to the team inbox.
          </p>
          <input value={subject} onChange={e => setSubject(e.target.value)} maxLength={200} aria-label="Subject" className="field text-xs" />
          <textarea value={message} onChange={e => setMessage(e.target.value)} maxLength={5000} rows={4} placeholder="Your reply..." aria-label="Reply message" className="field text-xs" />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={send}
              disabled={sending || message.trim().length < 5 || !subject.trim()}
              className="inline-flex items-center gap-1.5 btn-pill btn-pill--blue disabled:opacity-50"
            >
              {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              {sending ? "Sending..." : "Send email"}
            </button>
            <button type="button" onClick={() => setOpen(false)} disabled={sending} className="text-xs font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-200">
              Cancel
            </button>
          </div>
        </div>
      )}
      {result && <p role="status" className={`text-xs font-semibold ${result.ok ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>{result.text}</p>}
    </div>
  )
}

function ReportItem({ report, onSaved, onRemoved }: { report: Report; onSaved: (report: Partial<Report> & { id: string }) => void; onRemoved: (id: string) => void }) {
  const [open, setOpen] = useState(report.status === "new")
  const [notes, setNotes] = useState(report.admin_notes || "")
  const [saving, setSaving] = useState(false)
  // Which status button was clicked, so only that one shows a spinner.
  const [savingStatus, setSavingStatus] = useState<Report["status"] | null>(null)
  const [message, setMessage] = useState("")
  const type = TYPE_INFO[report.report_type] || TYPE_INFO.other
  const TypeIcon = type.icon

  const save = async (update: { status?: Report["status"]; admin_notes?: string }) => {
    setSaving(true)
    setSavingStatus(update.status ?? null)
    setMessage("")
    try {
      const res = await fetch(`/api/admin/developer-reports/${report.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(update),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || "Could not save.")
      onSaved({ id: report.id, ...data.report })
      setMessage("Saved")
    } catch (err: any) {
      setMessage(err.message || "Could not save.")
    } finally {
      setSaving(false)
      setSavingStatus(null)
    }
  }

  return (
    <li className="border-t border-slate-200 dark:border-[#233350] py-4">
      <button type="button" onClick={() => setOpen(value => !value)} aria-expanded={open} className="flex w-full items-start gap-3 text-left">
        <span className={`mt-0.5 inline-flex shrink-0 items-center gap-1 rounded px-2 py-0.5 text-[11px] font-bold ${type.className}`}>
          <TypeIcon className="h-3 w-3" /> {type.label}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-slate-900 dark:text-slate-100">{report.title}</span>
          <span className="block text-xs text-slate-500 dark:text-slate-400">
            {new Date(report.created_at).toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
            {report.severity && <> · <span className={`font-bold capitalize ${SEVERITY_CLASS[report.severity]}`}>{report.severity}</span></>}
            {report.attachments.length > 0 && <> · <Paperclip className="inline h-3 w-3" /> {report.attachments.length}</>}
            {report.contact_email ? " · left a contact email" : " · anonymous"}
          </span>
        </span>
        <span className="shrink-0 rounded bg-slate-100 dark:bg-[#1A2740] px-2 py-0.5 text-[11px] font-bold text-slate-600 dark:text-slate-300">
          {STATUSES.find(s => s.value === report.status)?.label}
        </span>
      </button>

      {open && (
        <div className="mt-3 space-y-3 pl-1 text-sm">
          <p className="whitespace-pre-line text-slate-700 dark:text-slate-300">{report.description}</p>
          {report.steps_to_reproduce && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Steps to reproduce</p>
              <p className="whitespace-pre-line text-slate-700 dark:text-slate-300">{report.steps_to_reproduce}</p>
            </div>
          )}
          <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-xs">
            {report.page_url && (
              <>
                <dt className="font-bold text-slate-400">Page affected</dt>
                <dd className="break-all text-slate-700 dark:text-slate-300">{report.page_url}</dd>
              </>
            )}
            <dt className="font-bold text-slate-400">Contact email</dt>
            <dd className="text-slate-700 dark:text-slate-300">
              {report.contact_email ? (
                <a href={`mailto:${report.contact_email}`} className="text-blue-600 hover:underline">{report.contact_email}</a>
              ) : (
                "None - sent anonymously"
              )}
            </dd>
            {report.user_agent && (
              <>
                <dt className="font-bold text-slate-400">Sent from</dt>
                <dd className="text-slate-700 dark:text-slate-300" title={report.user_agent}>{describeDevice(report.user_agent)} (the sender&apos;s browser)</dd>
              </>
            )}
          </dl>
          {report.contact_email && (
            <ReplyByEmail
              report={report}
              onSent={adminNotes => {
                setNotes(adminNotes)
                onSaved({ id: report.id, admin_notes: adminNotes })
              }}
            />
          )}
          {report.attachments.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {report.attachments.map(file => (
                <a
                  key={file.name}
                  href={file.url || undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded border border-slate-200 dark:border-[#233350] px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#1A2740]"
                >
                  <Paperclip className="h-3 w-3" /> {file.name} <span className="text-slate-400">({Math.max(1, Math.round(file.size / 1024))} KB)</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-400">Status</span>
            {STATUSES.map(status => (
              <button key={status.value} type="button" disabled={saving} onClick={() => save({ status: status.value })} aria-pressed={report.status === status.value} className={`inline-flex items-center gap-1.5 ${chipClass(report.status === status.value)}`}>
                {savingStatus === status.value && <Loader2 className="h-3 w-3 animate-spin" />}
                {status.label}
              </button>
            ))}
          </div>
          <div className="space-y-1.5">
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Internal notes for the team (never shown to the sender)"
              className="field min-h-16 text-xs"
            />
            <div className="flex items-center gap-3">
              <button type="button" disabled={saving} onClick={() => save({ admin_notes: notes })} className="btn-pill btn-pill--dark-solid disabled:opacity-50">
                {saving && !savingStatus ? <span className="inline-flex items-center gap-1.5"><Loader2 className="h-3 w-3 animate-spin" /> Saving...</span> : "Save notes"}
              </button>
              {message && <span className="text-xs font-semibold text-slate-500">{message}</span>}
              <AdminDeleteButton kind="dev-report" id={report.id} className="ml-auto" onDeleted={() => onRemoved(report.id)} />
            </div>
          </div>
        </div>
      )}
    </li>
  )
}

export function AdminDeveloperReports({ refreshKey = 0 }: { refreshKey?: number }) {
  // refreshKey: bumped by the dashboard's refresh button to re-fetch in place (filters are kept).
  const [reports, setReports] = useState<Report[] | null>(null)
  const [error, setError] = useState("")
  const [typeFilter, setTypeFilter] = useState<"all" | Report["report_type"]>("all")
  const [statusFilter, setStatusFilter] = useState<"open" | "all" | Report["status"]>("open")

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/developer-reports")
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || "Could not load developer reports.")
      setReports(data.reports || [])
      setError("")
    } catch (err: any) {
      setError(err.message || "Could not load developer reports.")
      setReports(current => current ?? [])
    }
  }, [])

  useEffect(() => { load() }, [load, refreshKey])

  const visible = useMemo(() => (reports || []).filter(report =>
    (typeFilter === "all" || report.report_type === typeFilter) &&
    (statusFilter === "all" || (statusFilter === "open" ? !["fixed", "dismissed"].includes(report.status) : report.status === statusFilter))
  ), [reports, typeFilter, statusFilter])

  const counts = useMemo(() => {
    const all = reports || []
    return {
      newCount: all.filter(r => r.status === "new").length,
      bugs: all.filter(r => r.report_type === "bug" && !["fixed", "dismissed"].includes(r.status)).length,
      ideas: all.filter(r => r.report_type === "improvement").length,
      security: all.filter(r => r.report_type === "security" && !["fixed", "dismissed"].includes(r.status)).length,
    }
  }, [reports])

  const onSaved = (update: Partial<Report> & { id: string }) =>
    setReports(current => (current || []).map(report => (report.id === update.id ? { ...report, ...update } : report)))

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-x-6 gap-y-5 md:grid-cols-4">
        <StatTile label="New reports" value={reports ? counts.newCount : "-"} note="Not looked at yet" />
        <StatTile label="Open bugs" value={reports ? counts.bugs : "-"} />
        <StatTile label="Improvement ideas" value={reports ? counts.ideas : "-"} note="All time" />
        <StatTile label="Open security reports" value={reports ? counts.security : "-"} />
      </div>

      <Card>
        <CardHeader className="flex-row flex-wrap items-start justify-between gap-3 space-y-0">
          <div>
            <CardTitle>Developer reports</CardTitle>
            <CardDescription>Anonymous bug reports, ideas and security reports sent from the public Developers page (/developers).</CardDescription>
          </div>
          <RefreshButton onRefresh={load} />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {(["all", "bug", "improvement", "security", "other"] as const).map(value => (
              <button key={value} type="button" onClick={() => setTypeFilter(value)} aria-pressed={typeFilter === value} className={chipClass(typeFilter === value)}>
                {value === "all" ? "All types" : TYPE_INFO[value].label}
              </button>
            ))}
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)} aria-label="Status" className="rounded border border-slate-200 dark:border-[#233350] bg-white dark:bg-[#0B1220] px-2.5 py-1.5 text-xs font-semibold">
              <option value="open">Open (not fixed/dismissed)</option>
              <option value="all">Every status</option>
              {STATUSES.map(status => <option key={status.value} value={status.value}>{status.label}</option>)}
            </select>
          </div>

          {error && <p className="text-sm font-semibold text-red-600 dark:text-red-400">{error} (Has the 20261006000300_developer_reports.sql migration been applied?)</p>}

          {reports === null ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-blue-600" /></div>
          ) : visible.length === 0 ? (
            <p className="rounded border border-dashed border-slate-300 dark:border-[#233350] p-6 text-center text-sm text-slate-500 dark:text-slate-400">No reports match these filters.</p>
          ) : (
            <ul>{visible.map(report => <ReportItem key={report.id} report={report} onSaved={onSaved} onRemoved={id => setReports(current => (current || []).filter(r => r.id !== id))} />)}</ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
