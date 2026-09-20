import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// The whole conversation a message belongs to, oldest first. Only messages the
// signed-in user is allowed to read come back (row-level security decides: their
// own received and sent messages, their organization team's, and everything for
// an administrator), so nobody can read a conversation they aren't part of.
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ message: "Authentication required." }, { status: 401 })

    const messageId = new URL(request.url).searchParams.get("messageId")
    if (!messageId) return NextResponse.json({ message: "A message is required." }, { status: 400 })

    const { data: anchor, error: anchorError } = await supabase.from("notifications").select("id, thread_id").eq("id", messageId).maybeSingle()
    if (anchorError?.message?.includes("thread_id")) {
      return NextResponse.json({ message: "Conversation history isn't available yet: the message-threads database update hasn't been applied." }, { status: 501 })
    }
    if (!anchor) return NextResponse.json({ message: "Message not found." }, { status: 404 })
    const threadId = anchor.thread_id || anchor.id

    const { data: rows, error } = await supabase
      .from("notifications")
      .select("id, sender_id, sender_name, sender_role, recipient_id, message, created_at, fanned_from, attachment_storage_path, attachment_file_name")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true })
      .limit(200)
    if (error) return NextResponse.json({ message: error.message }, { status: 400 })

    // A copy made for a teammate duplicates its original; show each message once.
    const ids = new Set((rows || []).map(row => row.id))
    const messages = (rows || []).filter(row => !row.fanned_from || !ids.has(row.fanned_from))

    // "Yours" also covers messages sent by teammates in your organization.
    const { data: myMembership } = await supabase.from("organization_members").select("organization_id").eq("profile_id", user.id).maybeSingle()
    const teammateIds = new Set<string>()
    if (myMembership) {
      const { data: teammates } = await supabase.from("organization_members").select("profile_id").eq("organization_id", myMembership.organization_id)
      for (const teammate of teammates || []) teammateIds.add(teammate.profile_id)
    }

    const { data: attachmentRows } = messages.length
      ? await supabase.from("notification_attachments").select("id, notification_id, storage_path, file_name").in("notification_id", messages.map(m => m.id))
      : { data: [] as { id: string; notification_id: string; storage_path: string; file_name: string | null }[] }

    const signed = async (path: string) => {
      const { data } = await supabase.storage.from("message-attachments").createSignedUrl(path, 60 * 60)
      return data?.signedUrl || null
    }

    const result = await Promise.all(messages.map(async row => {
      const attachments = await Promise.all(
        (attachmentRows || []).filter(a => a.notification_id === row.id).map(async a => ({ id: a.id, file_name: a.file_name, url: await signed(a.storage_path) }))
      )
      if (attachments.length === 0 && row.attachment_storage_path) {
        attachments.push({ id: `${row.id}-legacy`, file_name: row.attachment_file_name, url: await signed(row.attachment_storage_path) })
      }
      return {
        id: row.id,
        sender_id: row.sender_id,
        sender_name: row.sender_name,
        sender_role: row.sender_role,
        recipient_id: row.recipient_id,
        message: row.message,
        created_at: row.created_at,
        mine: row.sender_id === user.id || (!!row.sender_id && teammateIds.has(row.sender_id)),
        attachments,
      }
    }))

    return NextResponse.json({ me: user.id, messages: result })
  } catch (error) {
    console.error("Message thread error:", error)
    return NextResponse.json({ message: "Could not load the conversation." }, { status: 503 })
  }
}
