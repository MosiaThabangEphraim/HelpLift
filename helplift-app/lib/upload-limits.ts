// One place for every file upload's limits: how many files, how big, which
// kinds. The API routes enforce them (checkUploadLimits) and the forms show
// them next to each upload area (describeUploadLimit), so what users are told
// and what's allowed can never drift apart.
//
// Files no longer pass through our own server (see lib/stage-uploads.ts), so
// these are the real limits - not Vercel's 4.5 MB request cap.

export type UploadLimit = {
  /** Most files in one go. */
  maxFiles: number
  /** Largest single file, in MB. */
  maxMB: number
  /** Allowed extensions, lower-case, without the dot. */
  extensions: string[]
  /** How the allowed kinds are described to people. */
  kinds: string
}

const IMAGES = ["png", "jpg", "jpeg", "webp", "gif"]
const DOCS = ["pdf", "png", "jpg", "jpeg"]
const OFFICE = ["pdf", "doc", "docx", "xls", "xlsx", "txt", "png", "jpg", "jpeg", "webp", "gif"]

export const UPLOAD_LIMITS = {
  /** Organization verification documents at registration (/register). */
  registrationDocuments: { maxFiles: 10, maxMB: 10, extensions: DOCS, kinds: "PDF, PNG or JPG" },
  /** One verification document at a time (dashboard Documents, /pending-verification). */
  organizationDocument: { maxFiles: 1, maxMB: 10, extensions: DOCS, kinds: "PDF, PNG or JPG" },
  /** Files attached to a need. */
  needAttachments: { maxFiles: 10, maxMB: 10, extensions: OFFICE, kinds: "images, PDF or Office documents" },
  /** Images and documents attached to an organization timeline post. */
  timelineAttachments: { maxFiles: 10, maxMB: 10, extensions: OFFICE, kinds: "images, PDF or Office documents" },
  /** Photos in an impact story. */
  storyImages: { maxFiles: 10, maxMB: 10, extensions: IMAGES, kinds: "PNG, JPG, WebP or GIF" },
  /** Photos of a Gift Library pledge. */
  giftPhotos: { maxFiles: 10, maxMB: 10, extensions: IMAGES, kinds: "PNG, JPG, WebP or GIF" },
  /** Photos with an offer to help with a need. */
  interestPhotos: { maxFiles: 10, maxMB: 10, extensions: IMAGES, kinds: "PNG, JPG, WebP or GIF" },
  /** Documents with a Gift Library claim. */
  giftClaimDocuments: { maxFiles: 10, maxMB: 10, extensions: OFFICE, kinds: "images, PDF or Office documents" },
  /** Delivery proof on a fulfillment. */
  fulfillmentProofs: { maxFiles: 10, maxMB: 10, extensions: [...IMAGES, "pdf"], kinds: "images or PDF" },
  /** Proof of payment for a donation (signed-in or guest). */
  donationProofs: { maxFiles: 5, maxMB: 10, extensions: [...IMAGES, "pdf"], kinds: "images or PDF" },
  /** Admin's proof of a withdrawal payout. */
  withdrawalProof: { maxFiles: 1, maxMB: 10, extensions: [...IMAGES, "pdf"], kinds: "an image or PDF" },
  /** Message attachments. */
  messageAttachments: { maxFiles: 5, maxMB: 10, extensions: OFFICE, kinds: "images, PDF or Office documents" },
  /** Admin announcement attachments. */
  announcementAttachments: { maxFiles: 5, maxMB: 10, extensions: OFFICE, kinds: "images, PDF or Office documents" },
  /** Organization logo. */
  organizationLogo: { maxFiles: 1, maxMB: 2, extensions: ["png", "jpg", "jpeg", "webp"], kinds: "PNG, JPG or WebP" },
  /** Giver profile picture (resized in the browser first). */
  avatar: { maxFiles: 1, maxMB: 2, extensions: ["png", "jpg", "jpeg", "webp"], kinds: "PNG, JPG or WebP" },
} satisfies Record<string, UploadLimit>

export type UploadPurpose = keyof typeof UPLOAD_LIMITS

/** e.g. "Up to 10 files, 10 MB each (PDF, PNG or JPG)" or "1 file, up to 2 MB (PNG, JPG or WebP)". */
export function describeUploadLimit(limit: UploadLimit) {
  return limit.maxFiles === 1
    ? `1 file, up to ${limit.maxMB} MB (${limit.kinds})`
    : `Up to ${limit.maxFiles} files, ${limit.maxMB} MB each (${limit.kinds})`
}

type FileLike = { name: string; size: number }

/** A friendly error message if `files` break `limit`, otherwise null. Used on both the server and in the browser. */
export function checkUploadLimits(files: FileLike[], limit: UploadLimit, alreadyAttached = 0): string | null {
  if (files.length + alreadyAttached > limit.maxFiles) {
    return limit.maxFiles === 1 ? "You can only upload 1 file here." : `You can upload up to ${limit.maxFiles} files here.`
  }
  for (const file of files) {
    if (file.size > limit.maxMB * 1024 * 1024) return `"${file.name}" is too large - the limit is ${limit.maxMB} MB per file.`
    const extension = file.name.split(".").pop()?.toLowerCase() || ""
    if (!limit.extensions.includes(extension)) return `"${file.name}" isn't an allowed file type. Use ${limit.kinds}.`
  }
  return null
}
