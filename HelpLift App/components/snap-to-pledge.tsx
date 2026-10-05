"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { ArrowRight, Camera, ImageUp, Loader2, X } from "lucide-react"
import { optimizeAndValidateFile } from "@/lib/media-optimizer"
import { OrgLogo } from "@/components/org-logo"

// "Snap to pledge" at the top of the giver's Pledge an Offering form. The
// giver photographs what they want to give (phones open the camera directly);
// Lifty (via /api/giver/gifts/analyze-photo) identifies the items, fills in the
// pledge form and suggests open needs they could help with instead. The form
// stays fully editable and the pledge still goes through admin review.
//
// Camera: phones and tablets use the file input's `capture` hint, which opens
// the native camera app. Desktop browsers ignore that hint (they'd just open
// the file picker), so on a computer "Take a photo" opens the webcam in a
// small preview window instead, falling back to the file picker if there's no
// camera or access is blocked.

export type PledgeDraft = { title: string; description: string; offering_type: string; quantity_or_value: string }

type NeedMatch = {
  id: string
  title: string
  location: string | null
  urgency: string | null
  organization: { name: string; logo_url: string | null }
  link: string
}

export function SnapToPledge({ onDraft }: { onDraft: (draft: PledgeDraft, photo: File) => void }) {
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [note, setNote] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [matches, setMatches] = useState<NeedMatch[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [cameraOpen, setCameraOpen] = useState(false)
  const [cameraReady, setCameraReady] = useState(false)

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(track => track.stop())
    streamRef.current = null
    setCameraReady(false)
    setCameraOpen(false)
  }

  // Release the webcam if the pledge form closes while it's on.
  useEffect(() => () => { streamRef.current?.getTracks().forEach(track => track.stop()) }, [])

  // Attach the stream once the preview window has rendered its <video>.
  useEffect(() => {
    if (cameraOpen && videoRef.current && streamRef.current) videoRef.current.srcObject = streamRef.current
  }, [cameraOpen])

  const isTouchDevice = () =>
    window.matchMedia?.("(pointer: coarse)").matches || /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)

  const takePhoto = async () => {
    if (isAnalyzing) return
    // Phones/tablets: the native camera via the file input's capture hint.
    if (isTouchDevice() || !navigator.mediaDevices?.getUserMedia) {
      fileInputRef.current?.click()
      return
    }
    // Computers: open the webcam ourselves.
    setNote(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false })
      streamRef.current = stream
      setCameraOpen(true)
    } catch (err: any) {
      const blocked = err?.name === "NotAllowedError" || err?.name === "SecurityError"
      setNote({
        type: "error",
        text: blocked
          ? "Camera access was blocked - allow it in your browser, or choose a photo from your files instead."
          : "No camera was found - choose a photo from your files instead.",
      })
      fileInputRef.current?.click()
    }
  }

  const capture = () => {
    const video = videoRef.current
    if (!video || !video.videoWidth) return
    const canvas = document.createElement("canvas")
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext("2d")?.drawImage(video, 0, 0)
    canvas.toBlob(blob => {
      stopCamera()
      if (blob) analyze(new File([blob], `photo-${Date.now()}.jpg`, { type: "image/jpeg" }))
    }, "image/jpeg", 0.92)
  }

  const analyze = async (file: File | undefined) => {
    if (!file || isAnalyzing) return
    setIsAnalyzing(true)
    setNote(null)
    setMatches([])
    try {
      // Same client-side check + compression as profile pictures: keeps the
      // upload small and rejects files that aren't really images.
      const photo = await optimizeAndValidateFile(file, { maxSizeMB: 1, maxWidthOrHeight: 1600 })
      if (photo.type === "application/pdf") throw new Error("Please choose a photo, not a PDF.")

      const formData = new FormData()
      formData.append("photo", photo)
      const res = await fetch("/api/giver/gifts/analyze-photo", { method: "POST", body: formData })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || "Lifty couldn't look at this photo right now. Please try again.")
      if (!data.donatable) throw new Error(data.message || "Lifty couldn't spot anything to pledge in this photo.")

      onDraft(data.draft, photo)
      setMatches(Array.isArray(data.matches) ? data.matches : [])
      setNote({ type: "success", text: "Lifty filled in your pledge and attached the photo - check the details before you submit." })
    } catch (err: any) {
      setNote({ type: "error", text: err?.message || "Lifty couldn't look at this photo right now. Please try again." })
    } finally {
      setIsAnalyzing(false)
    }
  }

  const privacyTip = "Your photo is analysed by AI to fill in the form. It's only attached to your pledge if you submit it."

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={takePhoto}
          disabled={isAnalyzing}
          data-tip={`Take a photo of what you'd like to give and Lifty fills in the form. ${privacyTip}`}
          className="inline-flex items-center gap-1.5 rounded-full bg-purple-600 px-3 py-1 text-xs font-bold text-white shadow-sm hover:bg-purple-700 disabled:opacity-60 transition-colors"
        >
          {isAnalyzing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
          {isAnalyzing ? "Looking..." : "Snap to pledge"}
        </button>
        {/* A separate picker without the capture hint, so phones can choose from the gallery too. */}
        <label
          data-tip={`Choose a photo and Lifty fills in the form. ${privacyTip}`}
          className={`inline-flex items-center gap-1 rounded-full border border-purple-200 dark:border-purple-900 px-2.5 py-1 text-xs font-semibold text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/40 transition-colors ${isAnalyzing ? "opacity-60 pointer-events-none" : "cursor-pointer"}`}
        >
          <ImageUp className="h-3.5 w-3.5" /> Upload
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={isAnalyzing}
            onChange={e => {
              analyze(e.target.files?.[0])
              e.target.value = ""
            }}
          />
        </label>
        <span className="text-[11px] text-slate-400 dark:text-slate-500">Lifty fills in the form from a photo</span>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={e => {
            analyze(e.target.files?.[0])
            e.target.value = ""
          }}
        />
      </div>

      {cameraOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/80 p-4" role="dialog" aria-modal="true" aria-label="Take a photo">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 p-4 shadow-2xl space-y-3">
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-100">
                <Camera className="h-4 w-4 text-purple-600" /> Take a photo of your items
              </p>
              <button type="button" onClick={stopCamera} aria-label="Close camera" className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="relative overflow-hidden rounded-xl bg-black aspect-[4/3]">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                onLoadedMetadata={() => setCameraReady(true)}
                className="h-full w-full object-cover"
              />
              {!cameraReady && (
                <div className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-slate-300">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Starting camera...
                </div>
              )}
            </div>
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => { stopCamera(); fileInputRef.current?.click() }}
                className="text-xs font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              >
                Choose a file instead
              </button>
              <button
                type="button"
                onClick={capture}
                disabled={!cameraReady}
                autoFocus
                className="inline-flex items-center gap-2 rounded-full bg-purple-600 px-5 py-2.5 text-sm font-bold text-white shadow-md hover:bg-purple-700 disabled:opacity-50 transition-colors"
              >
                <Camera className="h-4 w-4" /> Capture
              </button>
            </div>
          </div>
        </div>
      )}

      {note && (
        <p role="status" className={`text-xs font-semibold ${note.type === "success" ? "text-emerald-700 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
          {note.text}
        </p>
      )}

      {matches.length > 0 && (
        <div className="space-y-1.5 rounded border border-purple-200 dark:border-purple-900 bg-purple-50/60 dark:bg-purple-950/20 p-2.5">
          <p className="text-xs font-bold text-slate-700 dark:text-slate-200">These open needs could use exactly this:</p>
          <ul className="space-y-1.5">
            {matches.map(match => (
              <li key={match.id}>
                <Link
                  href={match.link}
                  target="_blank"
                  className="flex items-center gap-2.5 rounded bg-white/80 dark:bg-[#121B2E] border border-slate-200 dark:border-[#233350] px-3 py-2 hover:border-purple-400 transition-colors"
                >
                  <OrgLogo src={match.organization.logo_url} name={match.organization.name} className="h-7 w-7 text-[10px]" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-bold text-slate-900 dark:text-slate-100">{match.title}</span>
                    <span className="block truncate text-[11px] text-slate-500 dark:text-slate-400">
                      {match.organization.name}{match.location ? ` · ${match.location}` : ""}
                    </span>
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-purple-600" />
                </Link>
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Open a need to offer these to that organization directly, or pledge them to the Gift Library below.
          </p>
        </div>
      )}

      {note?.type === "success" && <p className="text-[10px] text-slate-400 dark:text-slate-500">{privacyTip}</p>}
    </div>
  )
}
