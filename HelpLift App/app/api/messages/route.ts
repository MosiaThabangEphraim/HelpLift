import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// Generic direct-messaging endpoint, backing three flows (all delivered as rows
// in public.notifications, so recipients see them in their existing
// notifications list — no separate inbox table):
//   - target: "admin"      -> any authenticated giver/organization messaging an admin
//   - recipientId given, sender is admin -> admin messaging any user/organization
//   - recipientId given, sender is giver/organization -> messaging each other
// Authorization is enforced inside the send_notification() SECURITY DEFINER
// function (20260914002500), not via RLS on the insert itself — a proven,
// reproducible RLS anomaly on this exact policy shape meant the row was
// rejected even when every check it depends on independently verified true.
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024 // 10MB

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ message: "Authentication required." }, { status: 401 })

    const contentType = request.headers.get("content-type") || ""
    let message = ""
    let target: string | undefined
    let recipientId: string | undefined
    let attachmentFiles: File[] = []

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData()
      message = String(formData.get("message") || "").trim()
      target = formData.get("target")?.toString()
      recipientId = formData.get("recipientId")?.toString()
      attachmentFiles = formData.getAll("attachments").filter((f): f is File => f instanceof File && f.size > 0)
      // "attachment" (singular) kept for older callers; new clients send "attachments".
      const legacyFile = formData.get("attachment")
      if (legacyFile instanceof File && legacyFile.size > 0) attachmentFiles.unshift(legacyFile)
    } else {
      const body = await request.json()
      message = typeof body.message === "string" ? body.message.trim() : ""
      target = body.target
      recipientId = body.recipientId
    }

    if (!message) return NextResponse.json({ message: "Message cannot be empty." }, { status: 400 })
    if (message.length > 2000) return NextResponse.json({ message: "Message is too long (2000 characters max)." }, { status: 400 })
    const oversizedFile = attachmentFiles.find((f) => f.size > MAX_ATTACHMENT_BYTES)
    if (oversizedFile) {
      return NextResponse.json({ message: `"${oversizedFile.name}" is too large (10MB max).` }, { status: 400 })
    }

    const { data: senderProfile } = await supabase.from("profiles").select("full_name, role").eq("id", user.id).single()
    if (!senderProfile) return NextResponse.json({ message: "Sender profile not found." }, { status: 404 })

    let recipientIdResolved: string
    let type: string
    let title: string

    if (target === "admin") {
      const { data: adminId, error: adminErr } = await supabase.rpc("get_any_admin_id")
      if (adminErr) return NextResponse.json({ message: adminErr.message }, { status: 400 })
      if (!adminId) return NextResponse.json({ message: "No administrator account is available to receive messages." }, { status: 503 })
      recipientIdResolved = adminId as unknown as string
      type = "message_to_admin"
      title = `Message from ${senderProfile.full_name}`
    } else if (recipientId) {
      recipientIdResolved = recipientId
      type = senderProfile.role === "admin" ? "admin_message" : "org_message"
      title = senderProfile.role === "admin" ? "Message from HelpLift Admin" : `Message from ${senderProfile.full_name}`
    } else {
      return NextResponse.json({ message: "A recipient is required." }, { status: 400 })
    }

    const uploadedAttachments: { path: string; name: string }[] = []
    for (const file of attachmentFiles) {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
      const storagePath = `${user.id}/${crypto.randomUUID()}-${safeName}`
      const { error: uploadError } = await supabase.storage
        .from("message-attachments")
        .upload(storagePath, file, {
          contentType: file.type || "application/octet-stream",
          upsert: false,
        })
      if (uploadError) return NextResponse.json({ message: uploadError.message }, { status: 400 })
      uploadedAttachments.push({ path: storagePath, name: file.name })
    }

    const { data: notificationId, error } = await supabase.rpc("send_notification", {
      p_recipient: recipientIdResolved,
      p_type: type,
      p_title: title,
      p_message: message,
      p_attachment_storage_path: uploadedAttachments[0]?.path || null,
      p_attachment_file_name: uploadedAttachments[0]?.name || null,
    })

    if (error) return NextResponse.json({ message: error.message }, { status: 400 })

    for (const { path, name } of uploadedAttachments) {
      const { error: attachmentInsertError } = await supabase.rpc("add_notification_attachment", {
        p_notification_id: notificationId,
        p_storage_path: path,
        p_file_name: name,
      })
      if (attachmentInsertError) console.warn("Notification attachment record warning:", attachmentInsertError.message)
    }

    return NextResponse.json({ notification: { id: notificationId } }, { status: 201 })
  } catch (error) {
    console.error("Send message error:", error)
    return NextResponse.json({ message: "Unable to send message right now." }, { status: 503 })
  }
}
