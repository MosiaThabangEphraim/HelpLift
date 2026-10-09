"use client"

import { useState } from "react"
import { AlertTriangle, Loader2, Trash2 } from "lucide-react"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import type { DeletableKind, DeletePreview } from "@/lib/admin-delete"

// The admin's Delete button for any record (see lib/admin-delete.ts). Clicking
// it first asks the server what the deletion involves, then shows a
// confirmation listing everything else that will be removed. Deletions with
// a warning also need "DELETE" typed to confirm; records that can't be
// deleted (e.g. a need with donations) explain why instead.
export function AdminDeleteButton({
  kind,
  id,
  onDeleted,
  label = "Delete",
  iconOnly = true, // a trash icon by default; pass iconOnly={false} for a labelled button
  className = "",
}: {
  kind: DeletableKind
  id: string
  onDeleted: () => void | Promise<void>
  label?: string
  iconOnly?: boolean
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [preview, setPreview] = useState<DeletePreview | null>(null)
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [typed, setTyped] = useState("")
  const [error, setError] = useState("")

  const start = async (event: React.MouseEvent) => {
    event.stopPropagation() // rows are often clickable themselves
    setOpen(true)
    setPreview(null)
    setTyped("")
    setError("")
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/records/${kind}/${id}`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || "Couldn't check this record.")
      setPreview(data.preview)
    } catch (err: any) {
      setError(err.message || "Couldn't check this record.")
    } finally {
      setLoading(false)
    }
  }

  const confirm = async () => {
    setDeleting(true)
    setError("")
    try {
      const res = await fetch(`/api/admin/records/${kind}/${id}`, { method: "DELETE" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || "Couldn't delete it.")
      setOpen(false)
      await onDeleted()
    } catch (err: any) {
      setError(err.message || "Couldn't delete it.")
    } finally {
      setDeleting(false)
    }
  }

  const needsTyping = !!preview?.warning
  const canDelete = !!preview && !preview.blocked && !deleting && (!needsTyping || typed.trim() === "DELETE")

  return (
    <>
      <button
        type="button"
        onClick={start}
        aria-label={iconOnly ? `${label} permanently` : undefined}
        data-tip="Delete permanently"
        className={
          iconOnly
            ? `btn-delete ${className}`
            : `btn-delete btn-delete--label ${className}`
        }
      >
        <Trash2 className="h-4 w-4" />
        {!iconOnly && label}
      </button>

      <AlertDialog open={open} onOpenChange={value => { if (!deleting) setOpen(value) }}>
        <AlertDialogContent onClick={event => event.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete permanently?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                {loading ? (
                  <p className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Checking what this includes...</p>
                ) : preview?.blocked ? (
                  <p className="flex gap-2 rounded border border-amber-300 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-950/30 p-3 text-amber-900 dark:text-amber-200">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {preview.blocked}
                  </p>
                ) : preview ? (
                  <>
                    <p>You're about to delete the <strong className="text-slate-900 dark:text-slate-100">{preview.title}</strong>. This can't be undone.</p>
                    {preview.linked.length > 0 && (
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-slate-100">This also deletes:</p>
                        <ul className="mt-1 list-disc space-y-0.5 pl-5">
                          {preview.linked.map(item => <li key={item.label}>{item.count} {item.label}</li>)}
                        </ul>
                      </div>
                    )}
                    {preview.warning && (
                      <p className="flex gap-2 rounded border border-amber-300 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-950/30 p-3 text-amber-900 dark:text-amber-200">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {preview.warning}
                      </p>
                    )}
                    {needsTyping && (
                      <label className="block space-y-1">
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Type DELETE to confirm</span>
                        <input value={typed} onChange={event => setTyped(event.target.value)} autoFocus className="field" />
                      </label>
                    )}
                    <p className="text-xs text-slate-500">The deletion is recorded in the Live activity log.</p>
                  </>
                ) : null}
                {error && <p className="font-semibold text-red-600 dark:text-red-400">{error}</p>}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <button
              type="button"
              onClick={confirm}
              disabled={!canDelete}
              className="inline-flex items-center justify-center gap-2 rounded bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              {deleting ? "Deleting..." : "Delete permanently"}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
