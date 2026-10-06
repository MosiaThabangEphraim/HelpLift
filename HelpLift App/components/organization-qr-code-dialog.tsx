"use client"

import { useEffect, useState } from "react"
import QRCode from "qrcode"
import { Check, Copy, Download, Loader2, QrCode } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

// Generates a QR code linking to this organization's PUBLIC profile page
// (/organizations/[id]) - entirely client-side (the `qrcode` package draws
// straight to a data URL, no server round trip, no external service), so an
// organization can download it and print/share it anywhere (flyers, a
// noticeboard, a business card) for people to scan straight to their page.
export function OrganizationQrCodeDialog({
  open,
  onOpenChange,
  organizationId,
  organizationName,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  organizationId: string
  organizationName: string
}) {
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const [error, setError] = useState("")
  const [copied, setCopied] = useState(false)

  const profileUrl = typeof window !== "undefined" ? `${window.location.origin}/organizations/${organizationId}` : ""

  useEffect(() => {
    if (!open) return
    setDataUrl(null)
    setError("")
    setCopied(false)
    QRCode.toDataURL(profileUrl, { width: 512, margin: 2, color: { dark: "#0f172a", light: "#ffffff" } })
      .then(setDataUrl)
      .catch(() => setError("Could not generate the QR code."))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const download = () => {
    if (!dataUrl) return
    const link = document.createElement("a")
    link.href = dataUrl
    link.download = `${organizationName.replace(/[^a-zA-Z0-9._-]/g, "_")}-qr-code.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(profileUrl)
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
            Your QR code
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-1 text-center">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Scanning this takes anyone straight to {organizationName}'s public HelpLift profile - download it to print on flyers, a noticeboard, or a business card.
          </p>

          {error && (
            <div className="rounded bg-red-50 dark:bg-red-950/40 p-3 text-sm font-semibold text-red-700 dark:text-red-300">{error}</div>
          )}

          <div className="flex items-center justify-center rounded border border-slate-200 dark:border-[#233350] bg-white p-4">
            {dataUrl ? (
              <img src={dataUrl} alt={`QR code linking to ${organizationName}'s HelpLift profile`} className="w-56 h-56" />
            ) : (
              <div className="w-56 h-56 flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
              </div>
            )}
          </div>

          <p className="text-xs text-slate-400 break-all">{profileUrl}</p>

          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={copyLink} className="flex-1">
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? "Copied" : "Copy link"}
            </Button>
            <Button type="button" onClick={download} disabled={!dataUrl} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white">
              <Download className="w-4 h-4" />
              Download
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
