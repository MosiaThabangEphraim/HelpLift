import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getOrgContext, insufficientRoleMessage, roleAtLeast } from "@/lib/organization-access"
import { readUploadedFiles } from "@/lib/staged-uploads"
import { checkUploadLimits, UPLOAD_LIMITS } from "@/lib/upload-limits"
import { logUserAction } from "@/lib/activity-log"
import { TIMELINE_BUCKET, TIMELINE_COLUMNS, withAttachmentUrls } from "@/lib/org-timeline"
import { readPostFields, storeAttachments } from "@/lib/org-timeline-server"

// Post to your organization's timeline (coordinator and up). Published straight
// away - no admin approval. Files arrive staged (lib/stage-uploads.ts).
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ message: "Authentication required." }, { status: 401 })

    const ctx = await getOrgContext<{ id: string; name: string }>(supabase, user.id, "id, name")
    if (!ctx) return NextResponse.json({ message: "Organization access required." }, { status: 403 })
    if (!roleAtLeast(ctx.role, "coordinator")) return NextResponse.json({ message: insufficientRoleMessage(ctx.role, "coordinator") }, { status: 403 })

    const formData = await request.formData()
    const { fields, problem } = readPostFields(formData)
    if (problem) return NextResponse.json({ message: problem }, { status: 400 })

    const files = await readUploadedFiles(formData, "attachments")
    const uploadProblem = checkUploadLimits(files, UPLOAD_LIMITS.timelineAttachments)
    if (uploadProblem) return NextResponse.json({ message: uploadProblem }, { status: 400 })

    const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle()
    const db = createAdminClient()
    const { data: post, error } = await db
      .from("org_timeline_posts")
      .insert({ ...fields, organization_id: ctx.organization.id, author_id: user.id, author_name: profile?.full_name || null })
      .select(TIMELINE_COLUMNS)
      .single()
    if (error || !post) return NextResponse.json({ message: error?.message || "Couldn't post right now." }, { status: 400 })

    let saved: any = post
    if (files.length > 0) {
      const attachments = await storeAttachments(ctx.organization.id, post.id, files)
      const { data: updated } = await db.from("org_timeline_posts").update({ attachments }).eq("id", post.id).select(TIMELINE_COLUMNS).single()
      if (updated) saved = updated
    }

    await logUserAction(supabase, "Posted on the organization timeline", fields.title || fields.body.slice(0, 80))
    const storage = db.storage.from(TIMELINE_BUCKET)
    return NextResponse.json({ post: withAttachmentUrls(saved, path => storage.getPublicUrl(path).data.publicUrl) }, { status: 201 })
  } catch (error: any) {
    console.error("Timeline post error:", error)
    return NextResponse.json({ message: error?.message || "Couldn't post right now." }, { status: 503 })
  }
}
