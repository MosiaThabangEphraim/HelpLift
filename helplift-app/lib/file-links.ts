// Links to private files that never expire.
//
// Private buckets can only be read through signed URLs, and a signed URL
// always has an expiry - so signing one when a page loads means the link dies
// if the page stays open. Pages link to /api/files/<bucket>/<path> instead
// (app/api/files/[bucket]/[...path]); that route signs a fresh, short-lived
// URL at the moment of the click, using the VISITOR's own session, so
// Supabase's storage policies still decide who may open each file.

export const PRIVATE_FILE_BUCKETS = [
  "message-attachments",
  "organization-documents",
  "donation-proofs",
  "withdrawal-proofs",
  "fulfillment-proofs",
  "gift-claim-documents",
  "gift-offering-photos",
  "support-interest-photos",
  "developer-reports",
  "tip-off-evidence",
] as const

export type PrivateFileBucket = (typeof PRIVATE_FILE_BUCKETS)[number]

/** A permanent link to a private file (or null when there's no file). */
export function fileUrl(bucket: PrivateFileBucket, path: string | null | undefined): string | null {
  if (!path) return null
  return `/api/files/${bucket}/${path.split("/").map(encodeURIComponent).join("/")}`
}
