"use client"

import { useEffect, useState } from "react"
import { AdminDeleteButton } from "@/components/admin-delete-button"
import { FileText, Loader2, PackageCheck, Trash2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { firstOf } from "@/lib/utils"

export type AdminFulfillment = {
  id: string
  status: "pending" | "in_progress" | "completed" | "cancelled"
  notes: string | null
  completed_at: string | null
  created_at: string
  proof_count: number
  organizations: { id: string; name: string } | { id: string; name: string }[] | null
  givers: { name: string; email: string } | { name: string; email: string }[] | null
  support_interests: { needs: { title: string } | { title: string }[] | null } | { needs: { title: string } | { title: string }[] | null }[] | null
  gift_offerings: { title: string; offering_type: string } | { title: string; offering_type: string }[] | null
}

type Proof = { id: string; fileName: string | null; signedUrl: string | null }

const STATUS_STYLES: Record<AdminFulfillment["status"], string> = {
  pending: "bg-amber-100 text-amber-700",
  in_progress: "bg-blue-100 text-blue-700",
  completed: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-slate-200 text-slate-600",
}

function needTitle(f: AdminFulfillment) {
  return firstOf(firstOf(f.support_interests)?.needs)?.title || firstOf(f.gift_offerings)?.title || "Community need"
}

// Gift Library fulfillments have no "need category" - a small badge next to
// the title is enough to distinguish them in the list, instead of pretending
// they're a need.
function sourceBadge(f: AdminFulfillment) {
  const gift = firstOf(f.gift_offerings)
  if (!gift) return null
  return <span className="rounded bg-purple-50 px-2 py-0.5 text-[10px] font-bold text-purple-700 capitalize">Gift · {gift.offering_type}</span>
}

// Admin overview of deliveries, with a viewer for the proof (photos, receipts,
// documents) the organization attached.
export function AdminFulfillmentsView({ fulfillments, onDelete, onChanged }: { fulfillments: AdminFulfillment[]; onDelete?: (id: string) => Promise<void> | void; onChanged?: () => Promise<void> | void }) {
  const [filter, setFilter] = useState<"all" | "completed" | "in_progress" | "pending" | "cancelled">("all")
  const [selected, setSelected] = useState<AdminFulfillment | null>(null)
  const visible = filter === "all" ? fulfillments : fulfillments.filter(f => f.status === filter)

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Fulfillments</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2 flex-wrap text-xs font-bold">
            {(["all", "completed", "in_progress", "pending", "cancelled"] as const).map(key => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`rounded px-3 py-1.5 capitalize ${filter === key ? "bg-blue-600 text-white" : "bg-slate-100 dark:bg-[#1A2740]"}`}
              >
                {key.replace("_", " ")}
              </button>
            ))}
          </div>

          {visible.length === 0 ? (
            <p className="rounded border border-dashed border-slate-300 dark:border-[#233350] p-6 text-center text-sm text-slate-500">No fulfillments to show.</p>
          ) : (
            <div className="space-y-3">
              {visible.map(f => (
                <div
                  key={f.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelected(f)}
                  onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelected(f) } }}
                  className="flex cursor-pointer flex-col gap-2 rounded border border-slate-200 dark:border-[#233350] p-4 hover:border-blue-300 dark:hover:border-blue-800 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <p className="flex items-center gap-2 font-semibold">{needTitle(f)} {sourceBadge(f)}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {firstOf(f.organizations)?.name || "Organization"} ← {firstOf(f.givers)?.name || "Giver"} · {new Date(f.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded px-3 py-1 text-xs font-bold capitalize ${STATUS_STYLES[f.status]}`}>{f.status.replace("_", " ")}</span>
                    <span className="inline-flex items-center gap-1 rounded bg-slate-100 dark:bg-[#1A2740] px-3 py-1 text-xs font-bold">
                      <FileText className="h-3 w-3" /> {f.proof_count} proof file{f.proof_count === 1 ? "" : "s"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <FulfillmentDetail
        fulfillment={selected}
        onClose={() => setSelected(null)}
        onDelete={onDelete ? async id => { await onDelete(id); setSelected(null) } : undefined}
        onChanged={async () => { setSelected(null); await onChanged?.() }}
      />
    </>
  )
}

function FulfillmentDetail({
  fulfillment,
  onClose,
  onDelete,
  onChanged,
}: {
  fulfillment: AdminFulfillment | null
  onClose: () => void
  onDelete?: (id: string) => Promise<void> | void
  onChanged?: () => Promise<void> | void
}) {
  // Stepping in on an active delivery: cancel it, or mark it completed.
  const [action, setAction] = useState<"cancelled" | "completed" | null>(null)
  const [reason, setReason] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const isActive = fulfillment?.status === "pending" || fulfillment?.status === "in_progress"
  const saveStatus = async () => {
    if (!fulfillment || !action) return
    setIsSaving(true)
    setError("")
    try {
      const res = await fetch(`/api/admin/fulfillments/${fulfillment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: action, reason }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || "Could not update this delivery.")
      setAction(null)
      setReason("")
      await onChanged?.()
    } catch (e: any) {
      setError(e?.message || "Could not update this delivery.")
    } finally {
      setIsSaving(false)
    }
  }
  const [proofs, setProofs] = useState<Proof[]>([])
  const [legacyUrl, setLegacyUrl] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [isDeleting, setIsDeleting] = useState(false)

  const deletable = fulfillment?.status === "completed" || fulfillment?.status === "cancelled"

  const handleDelete = async () => {
    if (!fulfillment || !onDelete) return
    setIsDeleting(true)
    setError("")
    try {
      await onDelete(fulfillment.id)
    } catch (e: any) {
      setError(e?.message || "Could not delete this fulfillment.")
    } finally {
      setIsDeleting(false)
    }
  }

  useEffect(() => {
    if (!fulfillment) return
    let cancelled = false
    setIsLoading(true)
    setError("")
    setProofs([])
    setLegacyUrl(null)
    ;(async () => {
      try {
        const res = await fetch(`/api/fulfillments/${fulfillment.id}`)
        const data = await res.json().catch(() => ({}))
        if (cancelled) return
        if (!res.ok) throw new Error(data.message || "Could not load the proof.")
        setProofs(data.proofs || [])
        setLegacyUrl((data.proofs || []).length === 0 ? data.proofSignedUrl || null : null)
      } catch (e: any) {
        if (!cancelled) setError(e.message || "Could not load the proof.")
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [fulfillment])

  const isPdf = (url: string | null) => !!url && /\.pdf($|\?)/i.test(url)

  return (
    <Dialog open={!!fulfillment} onOpenChange={open => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Fulfillment details</DialogTitle>
        </DialogHeader>
        {fulfillment && (
          <div className="space-y-4 pt-2">
            <div>
              <h3 className="flex items-center gap-2 text-lg font-bold">{needTitle(fulfillment)} {sourceBadge(fulfillment)}</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Organization: {firstOf(fulfillment.organizations)?.name || "-"}<br />
                Giver: {firstOf(fulfillment.givers)?.name || "-"} {firstOf(fulfillment.givers)?.email ? `· ${firstOf(fulfillment.givers)?.email}` : ""}
              </p>
              <span className={`mt-2 inline-block rounded px-3 py-1 text-xs font-bold capitalize ${STATUS_STYLES[fulfillment.status]}`}>{fulfillment.status.replace("_", " ")}</span>
              {fulfillment.completed_at && <span className="ml-2 text-xs text-slate-500">Completed {new Date(fulfillment.completed_at).toLocaleDateString()}</span>}
            </div>

            {fulfillment.notes && (
              <div>
                <p className="mb-1 text-xs font-bold uppercase tracking-wider text-slate-400">Notes</p>
                <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-line">{fulfillment.notes}</p>
              </div>
            )}

            <div>
              <p className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">
                <PackageCheck className="h-3.5 w-3.5" /> Delivery proof
              </p>
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
              ) : error ? (
                <p className="text-xs text-red-600">{error}</p>
              ) : proofs.length > 0 ? (
                <div className="grid grid-cols-2 gap-2">
                  {proofs.map(item => (
                    <a key={item.id} href={item.signedUrl || undefined} target="_blank" rel="noreferrer" className="block">
                      {isPdf(item.signedUrl) ? (
                        <span className="flex h-24 items-center justify-center rounded border border-slate-200 dark:border-[#233350] text-xs font-bold text-blue-600">📄 {item.fileName || "Document"}</span>
                      ) : item.signedUrl ? (
                        <img src={item.signedUrl} alt={item.fileName || "Delivery proof"} className="h-24 w-full rounded border border-slate-200 dark:border-[#233350] object-cover" />
                      ) : (
                        <span className="flex h-24 items-center justify-center rounded border text-xs text-slate-400">Unavailable</span>
                      )}
                    </a>
                  ))}
                </div>
              ) : legacyUrl ? (
                <a href={legacyUrl} target="_blank" rel="noreferrer" className="block">
                  {isPdf(legacyUrl) ? (
                    <span className="flex h-24 items-center justify-center rounded border text-xs font-bold text-blue-600">📄 Open document</span>
                  ) : (
                    <img src={legacyUrl} alt="Delivery proof" className="max-h-64 w-full rounded border border-slate-200 dark:border-[#233350] object-cover" />
                  )}
                </a>
              ) : (
                <p className="text-xs text-slate-400">No proof has been attached yet.</p>
              )}
            </div>

            {isActive && (
              <div className="space-y-2 border-t border-slate-200 dark:border-[#233350] pt-3">
                {action ? (
                  <>
                    <textarea
                      value={reason}
                      onChange={e => setReason(e.target.value)}
                      placeholder={action === "cancelled" ? "Why is this delivery being cancelled? (optional, shared with the giver and organization)" : "Note for the giver and organization (optional)"}
                      className="field min-h-16 text-xs"
                      autoFocus
                    />
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <button type="button" onClick={() => { setAction(null); setReason("") }} className="btn-pill btn-pill--neutral">Back</button>
                      <button type="button" onClick={saveStatus} disabled={isSaving} className={`btn-pill ${action === "cancelled" ? "btn-pill--red-solid" : "btn-pill--green"}`}>
                        {isSaving && <Loader2 className="animate-spin" />}
                        {action === "cancelled" ? "Confirm cancel" : "Confirm completed"}
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <button type="button" onClick={() => setAction("cancelled")} data-tip="Cancel a stuck or abandoned delivery. The giver and organization are told." className="btn-pill btn-pill--red">Cancel delivery</button>
                    <button type="button" onClick={() => setAction("completed")} data-tip="Mark this delivery as done, e.g. if it was confirmed outside HelpLift" className="btn-pill btn-pill--green">Mark completed</button>
                  </div>
                )}
              </div>
            )}

            {onDelete && fulfillment && (
              <div className="flex justify-end border-t border-slate-200 dark:border-[#233350] pt-3">
                <AdminDeleteButton kind="fulfillment" id={fulfillment.id} label="Delete record" onDeleted={handleDelete} />
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
