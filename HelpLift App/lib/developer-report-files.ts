// Shared rules for developer report proof files (app/developers and
// app/api/developer-reports). Files go straight from the browser to the
// private "developer-reports" storage bucket through one-time signed upload
// links - Vercel rejects request bodies over 4.5 MB, so they can't pass
// through our own API - and the server checks them before the report is saved.
// The bucket itself enforces the same size/type limits (see
// 20261006000300_developer_reports.sql).

export const DEV_REPORT_BUCKET = "developer-reports"
export const DEV_REPORT_MAX_FILES = 10
export const DEV_REPORT_MAX_FILE_BYTES = 25 * 1024 * 1024
export const DEV_REPORT_FILE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/pdf",
  "video/mp4",
  "video/webm",
]

// What a file really is, from its first bytes (never trust the name or the
// browser-reported type alone).
export function detectFileType(b: Uint8Array): string | null {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg"
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png"
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return "image/gif"
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "image/webp"
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return "application/pdf"
  if (b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) return "video/mp4"
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return "video/webm"
  return null
}

export function safeFileName(name: string, index: number) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80) || `file-${index + 1}`
}
