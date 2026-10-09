import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getOrgContext, roleAtLeast } from "@/lib/organization-access"
import { readUploadedFiles } from "@/lib/staged-uploads"
import { checkUploadLimits, UPLOAD_LIMITS } from "@/lib/upload-limits"
import { logUserAction } from "@/lib/activity-log"
import { TIMELINE_BUCKET, TIMELINE_COLUMNS, withAttachmentUrls } from "@/lib/org-timeline"
import { readPostFields, removeAttachmentFiles, storeAttachments } from "@/lib/org-timeline-server"

type Context = { params: Promise<{ id: string }> }

// Loads the post and checks the caller may change it: its author (coordinator
// and up), or any manager or owner of the organization. Pinning is for
// managers and owners only.
async function authorize(context: Context) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ message: "Authentication required." }, { status: 401 }) }
  const ctx = await getOrgContext<{ id: string }>(supabase, user.id, "id")
  if (!ctx || !roleAtLeast(ctx.role, "coordinator")) return { error: NextResponse.json({ message: "Organization access required." }, { status: 403 }) }

  const { id } = await context.params
  const db = createAdminClient()
  const { data: post } = await db.from("org_timeline_posts").select(TIMELINE_COLUMNS).eq("id", id).maybeSingle()
  if (!post || post.organization_id !== ctx.organization.id) return { error: NextResponse.json({ message: "Post not found." }, { status: 404 }) }

  const canManageAll = roleAtLeast(ctx.role, "manager")
  if (!canManageAll && post.author_id !== user.id) {
    return { error: NextResponse.json({ message: "You can only change your own posts. Ask a manager or owner." }, { status: 403 }) }
  }
  return { supabase, db, post: post as any, canManageAll, organizationId: ctx.organization.id }
}

export async function PATCH(request: Request, context: Context) {
  try {
    const auth = await authorize(context)
    if ("error" in auth) return auth.error
    const { supabase, db, post, canManageAll, organizationId } = auth

    const formData = await request.formData()
    const { fields, problem } = readPostFields(formData, true)
    if (problem) return NextResponse.json({ message: problem }, { status: 400 })
    const contentChanged = Object.keys(fields).length > 0

    const update: Record<string, any> = { ...fields, updated_at: new Date().toISOString() }
    if (contentChanged) update.edited_at = new Date().toISOString()
    // An event needs a date, also after editing.
    const finalType = fields.post_type ?? post.post_type
    const finalDate = "event_starts_at" in fields ? fields.event_starts_at : post.event_starts_at
    if (finalType === "event" && !finalDate) return NextResponse.json({ message: "Add the event's date and time." }, { status: 400 })

    if (formData.has("pinned")) {
      if (!canManageAll) return NextResponse.json({ message: "Only managers and owners can pin posts." }, { status: 403 })
      update.pinned = formData.get("pinned") === "true"
    }

    // Attachments: remove the ones asked for, then add any new files.
    let attachments: any[] = Array.isArray(post.attachments) ? post.attachments : []
    const removePaths = formData.getAll("remove_attachments").map(String)
    if (removePaths.length > 0) {
      const removable = attachments.filter(file => removePaths.includes(file.path)).map(file => file.path)
      await removeAttachmentFiles(removable)
      attachments = attachments.filter(file => !removable.includes(file.path))
      update.attachments = attachments
    }
    const files = await readUploadedFiles(formData, "attachments")
    if (files.length > 0) {
      const uploadProblem = checkUploadLimits(files, UPLOAD_LIMITS.timelineAttachments, attachments.length)
      if (uploadProblem) return NextResponse.json({ message: uploadProblem }, { status: 400 })
      update.attachments = [...attachments, ...(await storeAttachments(organizationId, post.id, files))]
    }
    if (removePaths.length > 0 || files.length > 0) update.edited_at = new Date().toISOString()

    const { data: saved, error } = await db.from("org_timeline_posts").update(update).eq("id", post.id).select(TIMELINE_COLUMNS).single()
    if (error || !saved) return NextResponse.json({ message: error?.message || "Couldn't save the post." }, { status: 400 })

    await logUserAction(supabase, "Edited a timeline post", saved.title || saved.body.slice(0, 80))
    const storage = db.storage.from(TIMELINE_BUCKET)
    return NextResponse.json({ post: withAttachmentUrls(saved, path => storage.getPublicUrl(path).data.publicUrl) })
  } catch (error: any) {
    console.error("Timeline edit error:", error)
    return NextResponse.json({ message: error?.message || "Couldn't save the post." }, { status: 503 })
  }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    const auth = await authorize(context)
    if ("error" in auth) return auth.error
    const { supabase, db, post } = auth

    const { error } = await db.from("org_timeline_posts").delete().eq("id", post.id)
    if (error) return NextResponse.json({ message: error.message }, { status: 400 })
    await removeAttachmentFiles((Array.isArray(post.attachments) ? post.attachments : []).map((file: any) => file.path))

    await logUserAction(supabase, "Deleted a timeline post", post.title || post.body.slice(0, 80))
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Timeline delete error:", error)
    return NextResponse.json({ message: "Couldn't delete the post." }, { status: 503 })
  }
}
