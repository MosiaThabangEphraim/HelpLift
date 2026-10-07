"use client"

import { useEffect, useRef, useState } from "react"
import { Building2, ImagePlus, Loader2, UserRound, X } from "lucide-react"
import { optimizeAndValidateFile } from "@/lib/media-optimizer"
import { checkUploadLimits, describeUploadLimit, UPLOAD_LIMITS } from "@/lib/upload-limits"

// Optional picture on the registration forms: a giver's display picture or an
// organization's logo. The image is resized and compressed in the browser
// first (like the dashboard's own uploaders), then handed back through
// `onChange` to be sent with the form. Saved on the server by
// lib/profile-picture.ts; changeable later from the dashboard.

export function ProfilePicturePicker({
  role,
  file,
  onChange,
}: {
  role: "giver" | "organization"
  file: File | null
  onChange: (file: File | null) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [isPreparing, setIsPreparing] = useState(false)
  const [error, setError] = useState("")
  const isLogo = role === "organization"
  const limit = isLogo ? UPLOAD_LIMITS.organizationLogo : UPLOAD_LIMITS.avatar

  // Preview of the chosen picture, released when it changes.
  useEffect(() => {
    if (!file) { setPreview(null); return }
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const choose = async (chosen: File | undefined) => {
    if (inputRef.current) inputRef.current.value = ""
    if (!chosen) return
    setError("")
    setIsPreparing(true)
    try {
      const optimized = await optimizeAndValidateFile(chosen, { isAvatar: true, maxSizeMB: 0.5, maxWidthOrHeight: 512 })
      const problem = checkUploadLimits([optimized], limit)
      if (problem) throw new Error(problem)
      onChange(optimized)
    } catch (err: any) {
      setError(err.message || "That picture can't be used.")
    } finally {
      setIsPreparing(false)
    }
  }

  const Placeholder = isLogo ? Building2 : UserRound

  return (
    <div>
      <label className="block mb-2 text-sm font-bold text-slate-800 dark:text-slate-200">
        {isLogo ? "Organization Logo" : "Display Picture"}{" "}
        <span className="text-slate-400 dark:text-slate-500 font-medium">(optional)</span>
      </label>
      <div className="flex items-center gap-4">
        <div className={`flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 ${isLogo ? "rounded" : "rounded-full"}`}>
          {isPreparing ? (
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
          ) : preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt={isLogo ? "Logo preview" : "Display picture preview"} className={`h-full w-full ${isLogo ? "object-contain" : "object-cover"}`} />
          ) : (
            <Placeholder className="h-8 w-8 text-slate-300 dark:text-slate-600" />
          )}
        </div>
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={isPreparing}
              className="inline-flex items-center gap-1.5 rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:border-blue-500 disabled:opacity-60"
            >
              <ImagePlus className="h-3.5 w-3.5 text-blue-600" />
              {file ? "Change" : isLogo ? "Choose logo" : "Choose picture"}
            </button>
            {file && !isPreparing && (
              <button
                type="button"
                onClick={() => { setError(""); onChange(null) }}
                className="inline-flex items-center gap-1 rounded px-2 py-2 text-xs font-bold text-slate-500 hover:text-red-600"
              >
                <X className="h-3.5 w-3.5" /> Remove
              </button>
            )}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {describeUploadLimit(limit)}. You can change it later from your dashboard.
          </p>
          {error && <p className="text-xs font-semibold text-red-600 dark:text-red-400">{error}</p>}
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={e => choose(e.target.files?.[0])}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
      />
    </div>
  )
}
