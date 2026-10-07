"use client"

import { useEffect, useState } from "react"
import QRCode from "qrcode"
import { Check, Copy, Download, Loader2, QrCode } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

// Generates a QR code linking straight to one specific need on the public
// Browse Needs page (/needs?need=<id>, which the page opens as its detail
// dialog automatically once its list loads) - same entirely client-side
// approach as organization-qr-code-dialog.tsx, no server round trip. Meant
// for a flyer or poster for one specific need ("50 school bags needed"),
// so the code jumps straight to donating for that need rather than the
// organization's whole profile.
export function NeedQrCodeDialog({
  open,
  onOpenChange,
  needId,
  needTitle,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  needId: string
  needTitle: string
}) {
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const [error, setError] = useState("")
  const [copied, setCopied] = useState(false)

  const needUrl = typeof window !== "undefined" ? `${window.location.origin}/needs?need=${needId}` : ""

  useEffect(() => {
    if (!open) return
    setDataUrl(null)
    setError("")
    setCopied(false)
    QRCode.toDataURL(needUrl, { width: 512, margin: 2, color: { dark: "#0f172a", light: "#ffffff" } })
      .then(setDataUrl)
      .catch(() => setError("Could not generate the QR code."))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const download = () => {
    if (!dataUrl) return
    const link = document.createElement("a")
    link.href = dataUrl
    link.download = `${needTitle.replace(/[^a-zA-Z0-9._-]/g, "_")}-qr-code.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(needUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError("Could not copy the link.")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="w-5 h-5 text-blue-600" />
            QR code for this need
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-1 text-center">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Scanning this takes anyone straight to "{needTitle}" on HelpLift - download it to print on a flyer, poster, or noticeboard for this specific need.
          </p>

          {error && (
            <div className="rounded bg-red-50 dark:bg-red-950/40 p-3 text-sm font-semibold text-red-700 dark:text-red-300">{error}</div>
          )}

          <div className="flex items-center justify-center rounded border border-slate-200 dark:border-[#233350] bg-white p-4">
            {dataUrl ? (
              <img src={dataUrl} alt={`QR code linking to "${needTitle}" on HelpLift`} className="w-56 h-56" />
            ) : (
              <div className="w-56 h-56 flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
              </div>
            )}
          </div>

          <p className="text-xs text-slate-400 break-all">{needUrl}</p>

          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={copyLink} data-tip="Copy this need's link to your clipboard" className="flex-1">
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? "Copied" : "Copy link"}
            </Button>
            <Button type="button" onClick={download} disabled={!dataUrl} data-tip="Save the QR code as a PNG image to print" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white">
              <Download className="w-4 h-4" />
              Download
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
