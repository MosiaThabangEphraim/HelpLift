"use client"

import { createClient } from "@/lib/supabase/client"
import { checkUploadLimits, type UploadLimit } from "@/lib/upload-limits"

// Vercel rejects any request to our server over 4.5 MB, so files can't travel
// inside a form to the API. Instead, before a form is sent, each file is
// uploaded straight to a private staging area in Supabase Storage with a
// one-time signed link (app/api/uploads/sign), and the form carries a small
// reference ("staged:{...}") in its place. The API route turns the reference
// back into the real file (lib/staged-uploads.ts) and handles it exactly as
// before. Usage: `body: await stageFormFiles(formData, UPLOAD_LIMITS.x)`.

export const STAGED_PREFIX = "staged:"
const STAGING_BUCKET = "upload-staging"

/**
 * Returns a copy of `formData` with every file swapped for a staged
 * reference. If `limit` is given, the files are checked against it first, so
 * people hear about a too-large file before waiting for it to upload. Throws
 * an Error with a friendly message on any problem.
 */
export async function stageFormFiles(formData: FormData, limit?: UploadLimit): Promise<FormData> {
  const entries = Array.from(formData.entries())
  const files = entries.filter(([, value]) => value instanceof File && value.size > 0).map(([, value]) => value as File)
  if (files.length === 0) return formData

  if (limit) {
    const problem = checkUploadLimits(files, limit)
    if (problem) throw new Error(problem)
  }

  const signRes = await fetch("/api/uploads/sign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ files: files.map(file => ({ name: file.name, size: file.size, type: file.type })) }),
  })
  const signed = await signRes.json().catch(() => ({}))
  // Staging not available (e.g. its migration hasn't been applied yet): fall
  // back to sending the files inside the form as before - fine locally and for
  // small files, so uploads keep working instead of failing outright.
  if (signRes.status === 503) return formData
  if (!signRes.ok || !Array.isArray(signed.uploads)) throw new Error(signed.message || "Couldn't upload your files right now. Please try again.")

  const storage = createClient().storage.from(STAGING_BUCKET)
  const references = await Promise.all(files.map(async (file, index) => {
    const { path, token } = signed.uploads[index]
    const { error } = await storage.uploadToSignedUrl(path, token, file, { contentType: file.type || "application/octet-stream" })
    if (error) throw new Error(`Couldn't upload "${file.name}". Please check your connection and try again.`)
    return STAGED_PREFIX + JSON.stringify({ path, name: file.name, type: file.type || "application/octet-stream" })
  }))

  const staged = new FormData()
  let fileIndex = 0
  for (const [key, value] of entries) {
    if (value instanceof File) {
      if (value.size > 0) staged.append(key, references[fileIndex++])
    } else {
      staged.append(key, value)
    }
  }
  return staged
}
