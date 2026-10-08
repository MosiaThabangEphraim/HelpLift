import { UPLOAD_LIMITS } from "@/lib/upload-limits"

// The optional picture chosen while registering: a giver's display picture or
// an organization's logo. Used by app/api/register (the registration form).
// Saved with the service role because at sign-up there's no session yet. Both can be
// changed later from the dashboards (app/api/giver/avatar,
// app/api/organization/profile).

const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"]
const ALLOWED_EXTENSIONS = /\.(png|jpe?g|webp)$/i

const TARGET = {
  giver: { bucket: "profile-pictures", table: "givers", column: "avatar_url", prefix: "avatar", limit: UPLOAD_LIMITS.avatar },
  organization: { bucket: "organization-branding", table: "organizations", column: "logo_url", prefix: "logo", limit: UPLOAD_LIMITS.organizationLogo },
} as const

// The file's first bytes must really be a JPEG, PNG or WebP - not just its name.
async function hasImageSignature(file: File) {
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer())
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  const isPng = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
  const isWebp = bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  return isJpeg || isPng || isWebp
}

/** A friendly problem with the picture, or null if it's fine. */
export async function checkProfilePicture(file: File, role: "giver" | "organization"): Promise<string | null> {
  const { limit } = TARGET[role]
  if (!ALLOWED_TYPES.includes(file.type) || !ALLOWED_EXTENSIONS.test(file.name)) return `Use a ${limit.kinds} image for the picture.`
  if (file.size > limit.maxMB * 1024 * 1024) return `The picture must be smaller than ${limit.maxMB} MB.`
  if (!(await hasImageSignature(file))) return "The picture isn't a valid image file."
  return null
}

/**
 * Stores the picture and puts it on the user's giver or organization row.
 * Returns true if it was saved. Never throws - a picture problem must not
 * undo a registration that otherwise worked.
 */
export async function saveProfilePicture(admin: any, userId: string, role: "giver" | "organization", file: File): Promise<boolean> {
  const target = TARGET[role]
  try {
    if (await checkProfilePicture(file, role)) return false
    const { data: row } = await admin.from(target.table).select("id").eq("profile_id", userId).maybeSingle()
    if (!row) return false

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
    const storagePath = `${userId}/${target.prefix}-${Date.now()}-${safeName}`
    const storage = admin.storage.from(target.bucket)
    const { error: uploadError } = await storage.upload(storagePath, file, { contentType: file.type, upsert: false })
    if (uploadError) {
      console.warn("Registration picture upload failed:", uploadError.message)
      return false
    }
    const { data: { publicUrl } } = storage.getPublicUrl(storagePath)
    const { error: updateError } = await admin.from(target.table).update({ [target.column]: publicUrl }).eq("id", row.id)
    if (updateError) {
      await storage.remove([storagePath]).catch(() => undefined)
      console.warn("Registration picture save failed:", updateError.message)
      return false
    }
    return true
  } catch (error) {
    console.warn("Registration picture error:", error)
    return false
  }
}
