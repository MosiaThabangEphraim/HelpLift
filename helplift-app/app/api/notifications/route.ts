import { NextResponse } from "next/server"
import { fileUrl } from "@/lib/file-links"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ message: "Authentication required." }, { status: 401 })
  const { data, error } = await supabase
    .from("notifications")
    .select("id, type, title, message, sender_id, sender_name, sender_role, reply_to_id, reply_to_snippet, read_at, delivered_at, created_at, attachment_storage_path, attachment_file_name")
    // Only messages addressed to this user. Row-level security also lets people
    // read the messages they SENT (for conversation history), so the inbox must
    // filter by recipient explicitly.
    .eq("recipient_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50)
  if (error) return NextResponse.json({ message: error.message }, { status: 400 })

  // Loading your own inbox is the "delivered" moment for anything that
  // hasn't reached that state yet - the sender can then see a filled-in
  // second checkmark, same idea as WhatsApp's delivered tick.
  const undelivered = (data || []).filter(item => !item.delivered_at).map(item => item.id)
  if (undelivered.length > 0) {
    const deliveredAt = new Date().toISOString()
    await supabase.from("notifications").update({ delivered_at: deliveredAt }).in("id", undelivered)
    for (const item of data || []) {
      if (undelivered.includes(item.id)) item.delivered_at = deliveredAt
    }
  }

  const notifications = await Promise.all(
    (data || []).map(async (item) => {
      let attachmentUrl: string | null = null
      if (item.attachment_storage_path) {
        const signed = { signedUrl: fileUrl("message-attachments", item.attachment_storage_path) }
        attachmentUrl = signed?.signedUrl || null
      }

      const { data: attachmentRows } = await supabase
        .from("notification_attachments")
        .select("id, storage_path, file_name")
        .eq("notification_id", item.id)
        .order("created_at", { ascending: true })
      const attachments = await Promise.all(
        (attachmentRows || []).map(async (row) => {
          const signed = { signedUrl: fileUrl("message-attachments", row.storage_path) }
          return { id: row.id, file_name: row.file_name, url: signed?.signedUrl || null }
        })
      )

      return { ...item, attachmentUrl, attachments }
    })
  )

  return NextResponse.json({ notifications })
}
