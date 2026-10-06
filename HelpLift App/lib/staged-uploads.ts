import { createAdminClient } from "@/lib/supabase/admin"

// Server half of lib/stage-uploads.ts: turns the "staged:{...}" references a
// form carries back into real File objects (downloaded from the private
// staging bucket), so each API route can validate and store them exactly as
// it always has. A staged copy is deleted as soon as it's been read. Real File
// entries (e.g. from a script or local testing) are passed through unchanged.

const STAGED_PREFIX = "staged:"
const STAGING_BUCKET = "upload-staging"
// Paths are always "<date>/<uuid>/<file name>" as handed out by app/api/uploads/sign.
const STAGED_PATH = /^\d{4}-\d{2}-\d{2}\/[0-9a-f-]{36}\/[^/]+$/i

async function resolveEntry(value: FormDataEntryValue): Promise<File | null> {
  if (value instanceof File) return value.size > 0 ? value : null
  if (typeof value !== "string" || !value.startsWith(STAGED_PREFIX)) return null

  let ref: { path?: unknown; name?: unknown; type?: unknown }
  try {
    ref = JSON.parse(value.slice(STAGED_PREFIX.length))
  } catch {
    throw new Error("A file reference was invalid. Please try again.")
  }
  const path = typeof ref.path === "string" ? ref.path : ""
  if (!STAGED_PATH.test(path)) throw new Error("A file reference was invalid. Please try again.")

  const storage = createAdminClient().storage.from(STAGING_BUCKET)
  const { data, error } = await storage.download(path)
  if (error || !data) throw new Error("One of your files didn't finish uploading. Please try again.")
  // Read once, then discard the staged copy.
  storage.remove([path]).catch(() => {})

  const name = typeof ref.name === "string" && ref.name ? ref.name.slice(0, 200) : path.split("/").pop() || "file"
  const type = typeof ref.type === "string" ? ref.type : data.type || "application/octet-stream"
  return new File([data], name, { type })
}

/** Every file sent under `key` - staged or direct. */
export async function readUploadedFiles(formData: FormData, key: string): Promise<File[]> {
  const files = await Promise.all(formData.getAll(key).map(resolveEntry))
  return files.filter((file): file is File => !!file)
}

/** The first file sent under `key`, or null. */
export async function readUploadedFile(formData: FormData, key: string): Promise<File | null> {
  const value = formData.get(key)
  return value === null ? null : resolveEntry(value)
}

/** True if a form value is a staged-file reference (so string-collecting loops can skip it). */
export function isStagedReference(value: FormDataEntryValue) {
  return typeof value === "string" && value.startsWith(STAGED_PREFIX)
}
