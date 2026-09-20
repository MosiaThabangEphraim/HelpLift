"use client"

import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

// Asked whenever an administrator rejects or declines something. The message
// is optional; if given it's included in the notification sent to the person or
// organization affected, so they know why.
export function RejectReasonDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm rejection",
  onCancel,
  onConfirm,
}: {
  open: boolean
  title: string
  description: string
  confirmLabel?: string
  onCancel: () => void
  onConfirm: (reason: string) => Promise<void> | void
}) {
  const [reason, setReason] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setReason("")
      setIsSaving(false)
    }
  }, [open])

  const confirm = async () => {
    setIsSaving(true)
    try {
      await onConfirm(reason.trim())
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={next => !next && !isSaving && onCancel()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-1">
          <Label htmlFor="reject-reason">Message explaining why (optional)</Label>
          <textarea
            id="reject-reason"
            rows={4}
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="e.g. The photos don't match the story. Please upload clearer images."
            className="w-full rounded-xl border border-slate-200 dark:border-[#233350] bg-white dark:bg-[#0B1220] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSaving}>Cancel</Button>
          <Button type="button" onClick={confirm} disabled={isSaving} className="bg-red-600 hover:bg-red-700 text-white">
            {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
