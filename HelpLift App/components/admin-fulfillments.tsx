"use client"

import { useEffect, useState } from "react"
import { FileText, Loader2, PackageCheck } from "lucide-react"
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
}

type Proof = { id: string; fileName: string | null; signedUrl: string | null }

const STATUS_STYLES: Record<AdminFulfillment["status"], string> = {
  pending: "bg-amber-100 text-amber-700",
  in_progress: "bg-blue-100 text-blue-700",
  completed: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-slate-200 text-slate-600",
}

function needTitle(f: AdminFulfillment) {
  return firstOf(firstOf(f.support_interests)?.needs)?.title || "Community need"
}

// Admin overview of deliveries, with a viewer for the proof (photos, receipts,
// documents) the organization attached.
export function AdminFulfillmentsView({ fulfillments }: { fulfillments: AdminFulfillment[] }) {
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
                className={`rounded-full px-3 py-1.5 capitalize ${filter === key ? "bg-blue-600 text-white" : "bg-slate-100 dark:bg-[#1A2740]"}`}
              >
                {key.replace("_", " ")}
              </button>
            ))}
          </div>

          {visible.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-300 dark:border-[#233350] p-6 text-center text-sm text-slate-500">No fulfillments to show.</p>
          ) : (
            <div className="space-y-3">
              {visible.map(f => (
                <div
                  key={f.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelected(f)}
                  onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelected(f) } }}
                  className="flex cursor-pointer flex-col gap-2 rounded-2xl border border-slate-200 dark:border-[#233350] p-4 hover:border-blue-300 dark:hover:border-blue-800 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <p className="font-semibold">{needTitle(f)}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {firstOf(f.organizations)?.name || "Organization"} ← {firstOf(f.givers)?.name || "Giver"} · {new Date(f.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-3 py-1 text-xs font-bold capitalize ${STATUS_STYLES[f.status]}`}>{f.status.replace("_", " ")}</span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-[#1A2740] px-3 py-1 text-xs font-bold">
                      <FileText className="h-3 w-3" /> {f.proof_count} proof file{f.proof_count === 1 ? "" : "s"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <FulfillmentDetail fulfillment={selected} onClose={() => setSelected(null)} />
    </>
  )
}

function FulfillmentDetail({ fulfillment, onClose }: { fulfillment: AdminFulfillment | null; onClose: () => void }) {
  const [proofs, setProofs] = useState<Proof[]>([])
  const [legacyUrl, setLegacyUrl] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

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
              <h3 className="text-lg font-bold">{needTitle(fulfillment)}</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Organization: {firstOf(fulfillment.organizations)?.name || "—"}<br />
                Giver: {firstOf(fulfillment.givers)?.name || "—"} {firstOf(fulfillment.givers)?.email ? `· ${firstOf(fulfillment.givers)?.email}` : ""}
              </p>
              <span className={`mt-2 inline-block rounded-full px-3 py-1 text-xs font-bold capitalize ${STATUS_STYLES[fulfillment.status]}`}>{fulfillment.status.replace("_", " ")}</span>
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
                        <span className="flex h-24 items-center justify-center rounded-xl border border-slate-200 dark:border-[#233350] text-xs font-bold text-blue-600">📄 {item.fileName || "Document"}</span>
                      ) : item.signedUrl ? (
                        <img src={item.signedUrl} alt={item.fileName || "Delivery proof"} className="h-24 w-full rounded-xl border border-slate-200 dark:border-[#233350] object-cover" />
                      ) : (
                        <span className="flex h-24 items-center justify-center rounded-xl border text-xs text-slate-400">Unavailable</span>
                      )}
                    </a>
                  ))}
                </div>
              ) : legacyUrl ? (
                <a href={legacyUrl} target="_blank" rel="noreferrer" className="block">
                  {isPdf(legacyUrl) ? (
                    <span className="flex h-24 items-center justify-center rounded-xl border text-xs font-bold text-blue-600">📄 Open document</span>
                  ) : (
                    <img src={legacyUrl} alt="Delivery proof" className="max-h-64 w-full rounded-xl border border-slate-200 dark:border-[#233350] object-cover" />
                  )}
                </a>
              ) : (
                <p className="text-xs text-slate-400">No proof has been attached yet.</p>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
