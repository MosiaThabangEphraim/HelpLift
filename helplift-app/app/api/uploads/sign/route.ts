import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { clientIp, isRateLimited } from "@/lib/rate-limit"

// Hands out one-time signed upload links into the private "upload-staging"
// bucket (see lib/stage-uploads.ts and 20261006000400_upload_staging.sql).
// Files are only parked there until the API route that receives the form
// reads them (and deletes them); that route applies the real per-upload
// limits. This endpoint only stops abuse: a sanity cap on size and count,
// a rate limit, and a tidy-up of anything left behind.
//
// Open to signed-out visitors too - registration and guest donations upload
// before an account or session exists.

const BUCKET = "upload-staging"
const MAX_FILES = 20
const MAX_BYTES = 50 * 1024 * 1024 // the staging bucket's own cap

function today() {
  return new Date().toISOString().slice(0, 10)
}

// Staged files are deleted once read; this removes any a form never sent
// (e.g. the page was closed), from folders more than 2 days old. Best-effort.
async function cleanUpOldStaging() {
  try {
    const storage = createAdminClient().storage.from(BUCKET)
    const cutoff = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const { data: days } = await storage.list("", { limit: 100 })
    for (const day of days || []) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day.name) || day.name >= cutoff) continue
      const { data: folders } = await storage.list(day.name, { limit: 1000 })
      for (const folder of folders || []) {
        const { data: files } = await storage.list(`${day.name}/${folder.name}`, { limit: 100 })
        const paths = (files || []).map(file => `${day.name}/${folder.name}/${file.name}`)
        if (paths.length) await storage.remove(paths)
      }
    }
  } catch (error) {
    console.warn("Upload staging cleanup warning:", error)
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    // Signed-in people get more room than anonymous visitors.
    const limited = user
      ? isRateLimited(`upload-sign:user:${user.id}`, 60, 10 * 60 * 1000)
      : isRateLimited(`upload-sign:ip:${clientIp(request)}`, 30, 60 * 60 * 1000)
    if (limited) return NextResponse.json({ message: "You've uploaded a lot of files in a short time. Please wait a little and try again." }, { status: 429 })

    const body = await request.json().catch(() => ({}))
    const files: { name?: unknown; size?: unknown }[] = Array.isArray(body.files) ? body.files : []
    if (files.length === 0) return NextResponse.json({ message: "No files to upload." }, { status: 400 })
    if (files.length > MAX_FILES) return NextResponse.json({ message: `You can upload up to ${MAX_FILES} files at once.` }, { status: 400 })
    for (const file of files) {
      if (typeof file.size !== "number" || file.size <= 0 || file.size > MAX_BYTES) {
        return NextResponse.json({ message: `"${String(file.name || "A file")}" is too large - files can be up to 50 MB.` }, { status: 400 })
      }
    }

    const storage = createAdminClient().storage.from(BUCKET)
    const folder = `${today()}/${crypto.randomUUID()}`
    const uploads = []
    for (const [index, file] of files.entries()) {
      const safeName = String(file.name || "").replace(/[^a-zA-Z0-9._-]/g, "_").slice(-100) || `file-${index + 1}`
      const { data, error } = await storage.createSignedUploadUrl(`${folder}/${index + 1}-${safeName}`)
      if (error || !data) {
        console.warn("Upload staging sign warning (has 20261006000400_upload_staging.sql been applied?):", error?.message)
        return NextResponse.json({ message: "File uploads aren't available right now. Please try again shortly." }, { status: 503 })
      }
      uploads.push({ path: data.path, token: data.token })
    }

    if (Math.random() < 0.05) cleanUpOldStaging()
    return NextResponse.json({ uploads })
  } catch (error) {
    console.error("Upload sign error:", error)
    return NextResponse.json({ message: "File uploads aren't available right now." }, { status: 503 })
  }
}
