import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { clientIp, isRateLimited } from "@/lib/rate-limit"
import {
  DEV_REPORT_BUCKET,
  DEV_REPORT_FILE_TYPES,
  DEV_REPORT_MAX_FILE_BYTES,
  DEV_REPORT_MAX_FILES,
  safeFileName,
} from "@/lib/developer-report-files"

// Step 1 of sending a developer report with proof files: hands out one-time
// signed upload links (one per file) inside a fresh folder for this report.
// The browser uploads straight to the private bucket with them; step 2
// (POST /api/developer-reports) checks the files and saves the report.
export async function POST(request: Request) {
  try {
    if (isRateLimited(`dev-report-uploads:${clientIp(request)}`, 10, 60 * 60 * 1000)) {
      return NextResponse.json({ message: "Too many uploads in a short time - please try again in an hour." }, { status: 429 })
    }

    const body = await request.json().catch(() => ({}))
    const files: { name?: unknown; size?: unknown; type?: unknown }[] = Array.isArray(body.files) ? body.files : []
    if (files.length === 0) return NextResponse.json({ message: "No files to upload." }, { status: 400 })
    if (files.length > DEV_REPORT_MAX_FILES) return NextResponse.json({ message: `Attach up to ${DEV_REPORT_MAX_FILES} files.` }, { status: 400 })
    for (const file of files) {
      const name = String(file.name || "file")
      if (typeof file.size !== "number" || file.size <= 0 || file.size > DEV_REPORT_MAX_FILE_BYTES) {
        return NextResponse.json({ message: `"${name}" must be smaller than 25 MB.` }, { status: 400 })
      }
      if (!DEV_REPORT_FILE_TYPES.includes(String(file.type))) {
        return NextResponse.json({ message: `"${name}" isn't a supported file. Use an image, PDF, MP4 or WebM.` }, { status: 400 })
      }
    }

    const reportId = crypto.randomUUID()
    const storage = createAdminClient().storage.from(DEV_REPORT_BUCKET)
    const uploads = []
    for (const [index, file] of files.entries()) {
      const path = `${reportId}/${index + 1}-${safeFileName(String(file.name || ""), index)}`
      const { data, error } = await storage.createSignedUploadUrl(path)
      if (error || !data) {
        console.warn("Developer report upload link warning:", error?.message)
        return NextResponse.json({ message: "File uploads aren't available right now. Try again, or send the report without files." }, { status: 503 })
      }
      uploads.push({ path: data.path, token: data.token })
    }
    return NextResponse.json({ reportId, uploads })
  } catch (error) {
    console.error("Developer report uploads error:", error)
    return NextResponse.json({ message: "File uploads aren't available right now." }, { status: 503 })
  }
}
