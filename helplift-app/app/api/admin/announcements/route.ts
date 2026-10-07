import { NextResponse } from "next/server"
import { readUploadedFile, readUploadedFiles, isStagedReference } from "@/lib/staged-uploads"
import { checkUploadLimits, UPLOAD_LIMITS } from "@/lib/upload-limits"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

const TARGET_ROLES: Record<string, string[]> = {
  givers: ["giver"],
  organizations: ["organization"],
  both: ["giver", "organization"],
}

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024 // 10MB

type UploadedFile = { path: string; name: string }

// One admin action, two possible destinations - an in-app notification
// (broadcast to signed-in users/organizations) and/or the dismissible
// /login page banner (see 20260928000300_login_banner.sql and
// components/announcement-compose-dialog.tsx). deliveryType picks either
// or both; turning the banner back off later is a separate, simpler action
// in Platform Settings (PATCH /api/admin/settings), not this route.
//
// Attachments go out with whichever destination(s) are picked. The
// notification's copies live in the private "message-attachments" bucket
// (gated to the recipient, same as person-to-person messaging); the
// banner's copies are uploaded again into "login-banner-attachments" - a
// PUBLIC bucket, since a banner attachment has to be fetchable by a visitor
// with no session at all (see 20260928000400_login_banner_attachments.sql).
// Re-uploading rather than sharing one path keeps each bucket's visibility
// rules simple and independent.
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ message: "Authentication required." }, { status: 401 })

    const { data: adminProfile } = await supabase.from("profiles").select("role, full_name").eq("id", user.id).single()
    if (adminProfile?.role !== "admin") return NextResponse.json({ message: "Administrator access required." }, { status: 403 })

    const formData = await request.formData()
    const deliveryType = formData.get("deliveryType")?.toString()
    const target = formData.get("target")?.toString()
    const title = formData.get("title")?.toString() || ""
    const message = formData.get("message")?.toString() || ""
    const attachmentFiles = await readUploadedFiles(formData, "attachments")
    { const uploadProblem = checkUploadLimits(attachmentFiles, UPLOAD_LIMITS.announcementAttachments); if (uploadProblem) return NextResponse.json({ message: uploadProblem }, { status: 400 }) }

    // Channels: any combination of "notification", "banner" (login page) and
    // "homepage" (public notice on the homepage). Older callers send a single
    // deliveryType of notification / banner / both instead.
    const channelsRaw = formData.get("channels")?.toString()
    const channels = new Set(
      channelsRaw
        ? channelsRaw.split(",").map(c => c.trim()).filter(c => ["notification", "banner", "homepage"].includes(c))
        : deliveryType === "banner" ? ["banner"] : deliveryType === "both" ? ["notification", "banner"] : ["notification"]
    )
    if (channels.size === 0) return NextResponse.json({ message: "Choose at least one way to deliver the announcement." }, { status: 400 })
    const includesNotification = channels.has("notification")
    const includesBanner = channels.has("banner")
    const includesHomepage = channels.has("homepage")

    const trimmedTitle = title.trim()
    const trimmedMessage = message.trim()
    if (!trimmedMessage) return NextResponse.json({ message: "Message is required." }, { status: 400 })
    if (trimmedMessage.length > 2000) return NextResponse.json({ message: "Message is too long (2000 characters max)." }, { status: 400 })
    if (includesNotification && !trimmedTitle) return NextResponse.json({ message: "Title is required." }, { status: 400 })
    if (trimmedTitle.length > 200) return NextResponse.json({ message: "Title is too long (200 characters max)." }, { status: 400 })

    const oversizedFile = attachmentFiles.find((f) => f.size > MAX_ATTACHMENT_BYTES)
    if (oversizedFile) return NextResponse.json({ message: `"${oversizedFile.name}" is too large (10MB max).` }, { status: 400 })

    const uploadAllTo = async (bucket: string): Promise<UploadedFile[]> => {
      const results: UploadedFile[] = []
      for (const file of attachmentFiles) {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
        const storagePath = `${user.id}/${crypto.randomUUID()}-${safeName}`
        const { error: uploadError } = await supabase.storage
          .from(bucket)
          .upload(storagePath, file, { contentType: file.type || "application/octet-stream", upsert: false })
        if (uploadError) throw new Error(uploadError.message)
        results.push({ path: storagePath, name: file.name })
      }
      return results
    }

    let recipientCount = 0
    if (includesNotification) {
      const roles = TARGET_ROLES[target || ""]
      if (!roles) return NextResponse.json({ message: "Invalid target. Must be one of: givers, organizations, both." }, { status: 400 })

      const { data: recipients, error: recipientsError } = await supabase.from("profiles").select("id").in("role", roles)
      if (recipientsError) return NextResponse.json({ message: recipientsError.message }, { status: 400 })
      if (!recipients || recipients.length === 0) {
        return NextResponse.json({ message: "No recipients found for this target." }, { status: 400 })
      }

      // Uploaded once, then every recipient's notification points at the same
      // files - same bucket "message-attachments" already used for
      // person-to-person messages (20260917000200_message_attachments.sql).
      let uploadedAttachments: UploadedFile[]
      try {
        uploadedAttachments = await uploadAllTo("message-attachments")
      } catch (e: any) {
        return NextResponse.json({ message: e.message }, { status: 400 })
      }

      const rows = recipients.map((r) => ({
        recipient_id: r.id,
        sender_id: user.id,
        sender_name: adminProfile.full_name,
        sender_role: "admin",
        type: "admin_announcement",
        title: trimmedTitle,
        message: trimmedMessage,
        // Singular columns still populated with the FIRST file only, same
        // "keeps existing single-file display code working" pattern as
        // 20260918000600_multi_file_uploads.sql - the full list (if more
        // than one file) is in notification_attachments below.
        attachment_storage_path: uploadedAttachments[0]?.path || null,
        attachment_file_name: uploadedAttachments[0]?.name || null,
      }))

      // "Admins can create notifications" (RLS insert policy) checks
      // is_admin() per row, not per statement, so a single bulk insert with
      // many different recipient_ids is fine in one call.
      const { data: inserted, error: insertError } = await supabase.from("notifications").insert(rows).select("id")
      if (insertError) return NextResponse.json({ message: insertError.message }, { status: 400 })
      recipientCount = rows.length

      // add_notification_attachment (the RPC person-to-person messaging
      // uses) checks the caller is that ONE notification's own sender -
      // fine for a single message, but calling it once per (recipient ×
      // file) here could mean thousands of round trips for a large
      // broadcast. This route already verified the caller is an admin, so
      // the service-role client inserts every (notification, file) row in
      // one bulk call instead.
      if (uploadedAttachments.length > 1 && inserted && inserted.length > 0) {
        const admin = createAdminClient()
        const attachmentRows = inserted.flatMap((row) =>
          uploadedAttachments.map(({ path, name }) => ({
            notification_id: row.id,
            storage_path: path,
            file_name: name,
            uploaded_by: user.id,
          }))
        )
        const { error: attachmentInsertError } = await admin.from("notification_attachments").insert(attachmentRows)
        if (attachmentInsertError) console.warn("Announcement attachment record warning:", attachmentInsertError.message)
      }
    }

    if (includesBanner) {
      let bannerAttachments: UploadedFile[] = []
      try {
        bannerAttachments = await uploadAllTo("login-banner-attachments")
      } catch (e: any) {
        return NextResponse.json({ message: e.message }, { status: 400 })
      }

      const { error: bannerError } = await supabase
        .from("platform_settings")
        .update({
          value: { enabled: true, message: trimmedMessage, attachments: bannerAttachments },
          updated_at: new Date().toISOString(),
          updated_by: user.id,
        })
        .eq("key", "login_banner")
      if (bannerError) return NextResponse.json({ message: bannerError.message }, { status: 400 })
    }

    // Public notice on the homepage - everyone who opens the site sees it.
    // Attachments use the same public bucket as the login banner.
    if (includesHomepage) {
      let noticeAttachments: UploadedFile[] = []
      try {
        noticeAttachments = await uploadAllTo("login-banner-attachments")
      } catch (e: any) {
        return NextResponse.json({ message: e.message }, { status: 400 })
      }
      const { error: noticeError } = await supabase
        .from("platform_settings")
        .upsert({
          key: "homepage_notice",
          value: { enabled: true, title: trimmedTitle, message: trimmedMessage, attachments: noticeAttachments },
          updated_at: new Date().toISOString(),
          updated_by: user.id,
        }, { onConflict: "key" })
      if (noticeError) return NextResponse.json({ message: noticeError.message }, { status: 400 })
    }

    return NextResponse.json({ success: true, recipientCount, bannerUpdated: includesBanner, homepageUpdated: includesHomepage }, { status: 201 })
  } catch (error) {
    console.error("Send announcement error:", error)
    return NextResponse.json({ message: "Unable to send announcement right now." }, { status: 503 })
  }
}
