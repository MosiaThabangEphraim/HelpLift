import { createAdminClient } from "@/lib/supabase/admin"
import { TIMELINE_BUCKET, isTimelinePostType } from "@/lib/org-timeline"

// Server helpers shared by the organization timeline routes
// (app/api/organization/timeline). Files are stored with the service role
// after the routes' role checks.

const text = (value: FormDataEntryValue | null, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "")

/** Reads and checks a post's fields from a form. `partial` allows missing fields (for edits). */
export function readPostFields(formData: FormData, partial = false) {
  const fields: Record<string, any> = {}
  const problems: string[] = []

  if (formData.has("post_type") || !partial) {
    const type = text(formData.get("post_type"), 20) || "update"
    if (!isTimelinePostType(type)) problems.push("Choose a valid post type.")
    fields.post_type = type
  }
  if (formData.has("title") || !partial) fields.title = text(formData.get("title"), 150) || null
  if (formData.has("body") || !partial) {
    const body = text(formData.get("body"), 5000)
    if (body.length < 2) problems.push("Write something to share.")
    fields.body = body
  }
  if (formData.has("event_starts_at") || !partial) {
    const raw = text(formData.get("event_starts_at"), 40)
    if (raw) {
      const date = new Date(raw)
      if (Number.isNaN(date.getTime())) problems.push("The event date isn't valid.")
      else fields.event_starts_at = date.toISOString()
    } else fields.event_starts_at = null
  }
  if (formData.has("event_location") || !partial) fields.event_location = text(formData.get("event_location"), 200) || null

  // Only events keep event details.
  if (fields.post_type && fields.post_type !== "event") {
    fields.event_starts_at = null
    fields.event_location = null
  }
  if (fields.post_type === "event" && !fields.event_starts_at && !partial) problems.push("Add the event's date and time.")

  return { fields, problem: problems[0] || null }
}

/** Uploads files into the post's folder and returns their attachment records. */
export async function storeAttachments(organizationId: string, postId: string, files: File[]) {
  const storage = createAdminClient().storage.from(TIMELINE_BUCKET)
  const stored: { path: string; name: string; type: string; size: number }[] = []
  for (const file of files) {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80) || "file"
    const path = `${organizationId}/${postId}/${crypto.randomUUID()}-${safeName}`
    const { error } = await storage.upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false })
    if (error) {
      console.warn("Timeline attachment upload warning:", error.message)
      continue
    }
    stored.push({ path, name: file.name.slice(0, 200), type: file.type || "application/octet-stream", size: file.size })
  }
  return stored
}

export async function removeAttachmentFiles(paths: string[]) {
  if (paths.length === 0) return
  const { error } = await createAdminClient().storage.from(TIMELINE_BUCKET).remove(paths)
  if (error) console.warn("Timeline attachment removal warning:", error.message)
}
