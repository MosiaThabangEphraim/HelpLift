"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Building2, ExternalLink, Flag, Inbox, Loader2, Mail, Paperclip } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { StatTile } from "@/components/analytics/chart-parts"
import { RefreshButton } from "@/components/refresh-button"
import { AdminDeleteButton } from "@/components/admin-delete-button"
import { TIP_OFF_STATUSES, tipOffCategoryLabel, type TipOffStatus } from "@/lib/tip-offs"

// Admin Inquiries tab: everything sent in from outside the dashboards.
// - Tip-offs: anonymous whistleblower reports about registered organizations
//   (homepage "Anonymous tip-off" form, app/api/tip-offs), with evidence and
//   an investigation status/notes workflow.
// - Contact inquiries: the homepage contact form (contact_inquiry notifications).

type Attachment = { name: string; type: string; size: number; url: string | null }
type TipOff = {
  id: string
  created_at: string
  organization_id: string | null
  organization_name: string
  category: string
  details: string
  occurred_at_text: string | null
  contact_email: string | null
  attachments: Attachment[]
  status: TipOffStatus
  admin_notes: string | null
}

export type ContactInquiry = {
  id: string
  title: string
  message: string
  sender_name?: string | null
  read_at: string | null
  created_at: string
}

const CLOSED: TipOffStatus[] = ["unfounded", "closed"]

const chipClass = (active: boolean) =>
  `rounded px-3 py-1.5 text-xs font-bold transition-colors ${active ? "bg-blue-600 text-white" : "bg-slate-100 dark:bg-[#1A2740] text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-[#233350]"}`

const STATUS_CLASS: Record<TipOffStatus, string> = {
  new: "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300",
  investigating: "bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
  action_taken: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
  unfounded: "bg-slate-100 text-slate-600 dark:bg-[#1A2740] dark:text-slate-300",
  closed: "bg-slate-100 text-slate-600 dark:bg-[#1A2740] dark:text-slate-300",
}

const when = (iso: string) => new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })

function TipOffItem({ tipOff, onSaved, onRemoved, onOpenOrganization }: {
  tipOff: TipOff
  onSaved: (update: Partial<TipOff> & { id: string }) => void
  onRemoved: (id: string) => void
  onOpenOrganization?: (organizationId: string) => void
}) {
  const [open, setOpen] = useState(tipOff.status === "new")
  const [notes, setNotes] = useState(tipOff.admin_notes || "")
  const [saving, setSaving] = useState(false)
  const [savingStatus, setSavingStatus] = useState<TipOffStatus | null>(null)
  const [message, setMessage] = useState("")

  const save = async (update: { status?: TipOffStatus; admin_notes?: string }) => {
    setSaving(true)
    setSavingStatus(update.status ?? null)
    setMessage("")
    try {
      const res = await fetch(`/api/admin/tip-offs/${tipOff.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(update),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || "Could not save.")
      onSaved({ id: tipOff.id, ...data.tipOff })
      setMessage("Saved")
    } catch (err: any) {
      setMessage(err.message || "Could not save.")
    } finally {
      setSaving(false)
      setSavingStatus(null)
    }
  }

  return (
    <li className={`rounded p-4 ${tipOff.status === "new" ? "bg-red-50/60 dark:bg-red-950/20" : "bg-slate-50 dark:bg-[#121B2E]"}`}>
      <button type="button" onClick={() => setOpen(value => !value)} aria-expanded={open} className="flex w-full items-start gap-3 text-left">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-red-500 text-white">
          <Flag className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-slate-900 dark:text-slate-100 break-words">{tipOff.organization_name}</span>
          <span className="block text-xs text-slate-500 dark:text-slate-400">
            {tipOffCategoryLabel(tipOff.category)} · {when(tipOff.created_at)}
            {tipOff.attachments.length > 0 && <> · <Paperclip className="inline h-3 w-3" /> {tipOff.attachments.length}</>}
            {tipOff.contact_email ? " · left a contact email" : " · anonymous"}
          </span>
        </span>
        <span className={`shrink-0 rounded px-2 py-0.5 text-[11px] font-bold ${STATUS_CLASS[tipOff.status]}`}>
          {TIP_OFF_STATUSES.find(s => s.value === tipOff.status)?.label}
        </span>
      </button>

      {open && (
        <div className="mt-3 space-y-3 pl-11 max-md:pl-0 text-sm">
          <p className="whitespace-pre-line break-words text-slate-700 dark:text-slate-300">{tipOff.details}</p>
          <dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-4 gap-y-1 text-xs">
            {tipOff.occurred_at_text && (
              <>
                <dt className="font-bold text-slate-400">When</dt>
                <dd className="text-slate-700 dark:text-slate-300 break-words">{tipOff.occurred_at_text}</dd>
              </>
            )}
            <dt className="font-bold text-slate-400">Contact email</dt>
            <dd className="text-slate-700 dark:text-slate-300 break-all">
              {tipOff.contact_email ? (
                <a href={`mailto:${tipOff.contact_email}`} className="text-blue-600 hover:underline">{tipOff.contact_email}</a>
              ) : (
                "None - sent anonymously"
              )}
            </dd>
          </dl>

          <div className="flex flex-wrap gap-2">
            {tipOff.organization_id && onOpenOrganization && (
              <button
                type="button"
                onClick={() => onOpenOrganization(tipOff.organization_id!)}
                data-tip="Open this organization's details, documents and verification"
                className="inline-flex items-center gap-1.5 rounded bg-blue-50 dark:bg-blue-950/50 px-2.5 py-1 text-xs font-bold text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-950"
              >
                <Building2 className="h-3 w-3" /> View organization
              </button>
            )}
            {!tipOff.organization_id && (
              <span className="text-xs text-slate-500 dark:text-slate-400">Typed in by the sender - not matched to a registered organization.</span>
            )}
            {tipOff.attachments.map(file => (
              <a
                key={file.name}
                href={file.url || undefined}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex max-w-full items-center gap-1.5 rounded bg-white dark:bg-[#0B1220] px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-blue-600"
              >
                <Paperclip className="h-3 w-3 shrink-0" /> <span className="truncate">{file.name}</span>
                <span className="shrink-0 text-slate-400">({Math.max(1, Math.round(file.size / 1024))} KB)</span>
                <ExternalLink className="h-3 w-3 shrink-0" />
              </a>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-400">Status</span>
            {TIP_OFF_STATUSES.map(status => (
              <button key={status.value} type="button" disabled={saving} onClick={() => save({ status: status.value })} aria-pressed={tipOff.status === status.value} className={`inline-flex items-center gap-1.5 ${chipClass(tipOff.status === status.value)}`}>
                {savingStatus === status.value && <Loader2 className="h-3 w-3 animate-spin" />}
                {status.label}
              </button>
            ))}
          </div>
          <div className="space-y-1.5">
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Investigation notes for the team (never shown to the sender or the organization)"
              className="field min-h-16 text-xs"
            />
            <div className="flex items-center gap-3">
              <button type="button" disabled={saving} onClick={() => save({ admin_notes: notes })} className="rounded bg-slate-900 dark:bg-slate-100 px-3 py-1.5 text-xs font-bold text-white dark:text-slate-900 disabled:opacity-50">
                {saving && !savingStatus ? <span className="inline-flex items-center gap-1.5"><Loader2 className="h-3 w-3 animate-spin" /> Saving...</span> : "Save notes"}
              </button>
              {message && <span className="text-xs font-semibold text-slate-500">{message}</span>}
              <AdminDeleteButton kind="tip-off" id={tipOff.id} className="ml-auto" onDeleted={() => onRemoved(tipOff.id)} />
            </div>
          </div>
        </div>
      )}
    </li>
  )
}

function TipOffs({ refreshKey, onOpenOrganization }: { refreshKey: number; onOpenOrganization?: (organizationId: string) => void }) {
  const [tipOffs, setTipOffs] = useState<TipOff[] | null>(null)
  const [error, setError] = useState("")
  const [statusFilter, setStatusFilter] = useState<"open" | "all" | TipOffStatus>("open")

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/tip-offs")
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || "Could not load tip-offs.")
      setTipOffs(data.tipOffs || [])
      setError("")
    } catch (err: any) {
      setError(err.message || "Could not load tip-offs.")
      setTipOffs(current => current ?? [])
    }
  }, [])

  useEffect(() => { load() }, [load, refreshKey])

  const visible = useMemo(() => (tipOffs || []).filter(tipOff =>
    statusFilter === "all" || (statusFilter === "open" ? !CLOSED.includes(tipOff.status) : tipOff.status === statusFilter)
  ), [tipOffs, statusFilter])

  const counts = useMemo(() => {
    const all = tipOffs || []
    return {
      newCount: all.filter(t => t.status === "new").length,
      investigating: all.filter(t => t.status === "investigating").length,
      actionTaken: all.filter(t => t.status === "action_taken").length,
      total: all.length,
    }
  }, [tipOffs])

  const onSaved = (update: Partial<TipOff> & { id: string }) =>
    setTipOffs(current => (current || []).map(tipOff => (tipOff.id === update.id ? { ...tipOff, ...update } : tipOff)))

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-x-6 gap-y-5 md:grid-cols-4">
        <StatTile label="New tip-offs" value={tipOffs ? counts.newCount : "-"} note="Not looked at yet" />
        <StatTile label="Investigating" value={tipOffs ? counts.investigating : "-"} />
        <StatTile label="Action taken" value={tipOffs ? counts.actionTaken : "-"} />
        <StatTile label="All tip-offs" value={tipOffs ? counts.total : "-"} note="All time" />
      </div>

      <Card>
        <CardHeader className="flex-row flex-wrap items-start justify-between gap-3 space-y-0">
          <div>
            <CardTitle>Anonymous tip-offs</CardTitle>
            <CardDescription>Reports of illegal or suspicious activity by registered organizations, sent anonymously from the homepage. The organization is never told who reported it.</CardDescription>
          </div>
          <RefreshButton onRefresh={load} />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 max-md:flex-nowrap max-md:overflow-x-auto no-scrollbar max-md:pb-1 max-md:[&>*]:shrink-0">
            {(["open", "all", ...TIP_OFF_STATUSES.map(s => s.value)] as const).map(value => (
              <button key={value} type="button" onClick={() => setStatusFilter(value)} aria-pressed={statusFilter === value} className={chipClass(statusFilter === value)}>
                {value === "open" ? "Open" : value === "all" ? "All" : TIP_OFF_STATUSES.find(s => s.value === value)?.label}
              </button>
            ))}
          </div>

          {error && <p className="text-sm font-semibold text-red-600 dark:text-red-400">{error} (Has the 20261008000200_tip_offs.sql migration been applied?)</p>}

          {tipOffs === null ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-blue-600" /></div>
          ) : visible.length === 0 ? (
            <p className="rounded bg-slate-50 dark:bg-[#121B2E] p-6 text-center text-sm text-slate-500 dark:text-slate-400">No tip-offs match this filter.</p>
          ) : (
            <ul className="space-y-3">
              {visible.map(tipOff => (
                <TipOffItem
                  key={tipOff.id}
                  tipOff={tipOff}
                  onSaved={onSaved}
                  onRemoved={id => setTipOffs(current => (current || []).filter(t => t.id !== id))}
                  onOpenOrganization={onOpenOrganization}
                />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function ContactInquiries({ inquiries, onOpen, onDeleted }: { inquiries: ContactInquiry[]; onOpen: (item: ContactInquiry) => void; onDeleted: () => void | Promise<void> }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Contact inquiries</CardTitle>
        <CardDescription>Messages sent with the contact form on the homepage. Open one to read it and reply.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {inquiries.length === 0 ? (
          <p className="rounded bg-slate-50 dark:bg-[#121B2E] p-6 text-center text-sm text-slate-500 dark:text-slate-400">No contact inquiries yet.</p>
        ) : inquiries.map(item => (
          <div
            key={item.id}
            role="button"
            tabIndex={0}
            onClick={() => onOpen(item)}
            onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onOpen(item) } }}
            className={`w-full cursor-pointer rounded p-4 text-left transition-colors ${item.read_at ? "bg-slate-50 dark:bg-[#121B2E] hover:bg-slate-100 dark:hover:bg-[#1A2740]" : "bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-950/60"}`}
          >
            <div className="flex items-center justify-between gap-3">
              <p className="min-w-0 truncate text-sm font-bold">{item.sender_name || "Website visitor"}</p>
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-[11px] text-slate-400">{when(item.created_at)}</span>
                <AdminDeleteButton kind="message" id={item.id} onDeleted={onDeleted} iconOnly />
              </div>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 break-words">{item.title}</p>
            <p className="mt-1 truncate text-sm text-slate-600 dark:text-slate-300">{item.message}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

export type InquiriesView = "tip-offs" | "contact"

export function AdminInquiries({
  refreshKey = 0,
  view,
  onViewChange,
  inquiries,
  onOpenInquiry,
  onDeleted,
  onOpenOrganization,
}: {
  refreshKey?: number
  view: InquiriesView
  onViewChange: (view: InquiriesView) => void
  inquiries: ContactInquiry[]
  onOpenInquiry: (item: ContactInquiry) => void
  onDeleted: () => void | Promise<void>
  onOpenOrganization?: (organizationId: string) => void
}) {
  const unreadInquiries = inquiries.filter(item => !item.read_at).length
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Inquiries view">
        {([
          { value: "tip-offs", label: "Tip-offs", icon: Flag, tip: "Anonymous reports about registered organizations" },
          { value: "contact", label: "Contact inquiries", icon: Mail, tip: "Messages from the homepage contact form", count: unreadInquiries },
        ] as const).map(({ value, label, icon: Icon, tip, ...rest }) => (
          <button
            key={value}
            type="button"
            onClick={() => onViewChange(value)}
            aria-pressed={view === value}
            data-tip={tip}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-all ${view === value ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-600/25" : "bg-slate-100 dark:bg-[#1A2740] text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-[#233350]"}`}
          >
            <Icon className="h-4 w-4" /> {label}
            {"count" in rest && rest.count > 0 && <span className={`rounded-full px-1.5 text-[11px] ${view === value ? "bg-white/25" : "bg-blue-600 text-white"}`}>{rest.count}</span>}
          </button>
        ))}
        <span className="ml-auto inline-flex items-center gap-1.5 text-xs text-slate-400 max-md:hidden"><Inbox className="h-3.5 w-3.5" /> Everything sent in from the public website</span>
      </div>
      {view === "tip-offs"
        ? <TipOffs refreshKey={refreshKey} onOpenOrganization={onOpenOrganization} />
        : <ContactInquiries inquiries={inquiries} onOpen={onOpenInquiry} onDeleted={onDeleted} />}
    </div>
  )
}
