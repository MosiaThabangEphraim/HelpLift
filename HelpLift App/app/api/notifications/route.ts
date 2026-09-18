import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ message: "Authentication required." }, { status: 401 })
  const { data, error } = await supabase
    .from("notifications")
    .select("id, type, title, message, sender_name, sender_role, read_at, created_at, attachment_storage_path, attachment_file_name")
    .order("created_at", { ascending: false })
    .limit(50)
  if (error) return NextResponse.json({ message: error.message }, { status: 400 })

  const notifications = await Promise.all(
    (data || []).map(async (item) => {
      let attachmentUrl: string | null = null
      if (item.attachment_storage_path) {
        const { data: signed } = await supabase.storage
          .from("message-attachments")
          .createSignedUrl(item.attachment_storage_path, 60 * 60)
        attachmentUrl = signed?.signedUrl || null
      }

      const { data: attachmentRows } = await supabase
        .from("notification_attachments")
        .select("id, storage_path, file_name")
        .eq("notification_id", item.id)
        .order("created_at", { ascending: true })
      const attachments = await Promise.all(
        (attachmentRows || []).map(async (row) => {
          const { data: signed } = await supabase.storage.from("message-attachments").createSignedUrl(row.storage_path, 60 * 60)
          return { id: row.id, file_name: row.file_name, url: signed?.signedUrl || null }
        })
      )

      return { ...item, attachmentUrl, attachments }
    })
  )

  return NextResponse.json({ notifications })
}
