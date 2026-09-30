import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { sendEmail, escapeHtml, isMailerConfigured } from "@/lib/mailer"

// Called by a Supabase Database Webhook configured on public.notifications
// (event: Insert). This has no end-user session - Supabase calls it
// server-to-server - so it's protected by a shared secret header instead of
// a user auth check, and runs on the service role key to read the
// recipient's email (bypassing RLS, same pattern as the PayFast ITN route).
function serviceClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
      cookies: { getAll: () => [], setAll: () => {} },
    }
  )
}

// Brevo's transactional email API isn't meant for large payloads - this is
// a practical cap on the TOTAL size of files actually attached to one email
// (independent of the 10MB-per-file cap enforced when the announcement was
// composed/sent - see app/api/admin/announcements/route.ts and
// components/message-compose-dialog.tsx). Over this, the email still goes
// out, still names every attachment, just without the bytes - the
// recipient signs in to get the file itself instead.
const MAX_EMAIL_ATTACHMENT_BYTES = 15 * 1024 * 1024 // 15MB combined

export async function POST(request: Request) {
  try {
    const secret = process.env.NOTIFICATION_WEBHOOK_SECRET
    if (!secret || request.headers.get("x-webhook-secret") !== secret) {
      return NextResponse.json({ message: "Unauthorized." }, { status: 401 })
    }

    const body = await request.json()
    if (body.type !== "INSERT" || body.table !== "notifications") {
      return NextResponse.json({ message: "Ignored." }, { status: 200 })
    }

    const record = body.record as {
      id: string
      recipient_id: string
      title: string
      message: string
      attachment_storage_path?: string | null
      attachment_file_name?: string | null
    } | undefined
    if (!record?.recipient_id || !record.title || !record.message) {
      return NextResponse.json({ message: "Malformed payload." }, { status: 400 })
    }

    if (!isMailerConfigured()) {
      console.warn("Notification email skipped - SMTP is not configured.")
      return NextResponse.json({ message: "Mailer not configured." }, { status: 200 })
    }

    const supabase = serviceClient()
    const { data: profile } = await supabase
      .from("profiles")
      .select("email, full_name, email_notifications_enabled")
      .eq("id", record.recipient_id)
      .single()
    if (!profile?.email) {
      console.warn("Notification email skipped - no profile/email for recipient", record.recipient_id)
      return NextResponse.json({ message: "Recipient has no email." }, { status: 200 })
    }
    // Opt-out only ever covers this: emails for in-app notifications. Email
    // verification, password reset and every other Supabase Auth email are
    // sent through Supabase's own mailer, never this webhook, so they're
    // unaffected regardless of this flag.
    if (profile.email_notifications_enabled === false) {
      return NextResponse.json({ message: "Recipient has email notifications turned off." }, { status: 200 })
    }

    // The full attachment list (see 20260918000600_multi_file_uploads.sql -
    // notification_attachments holds every file; the singular
    // attachment_storage_path/attachment_file_name columns on the row itself
    // are only ever the FIRST one, kept for older display code). Most
    // notifications have none of this at all, which is the common case.
    const { data: attachmentRows } = await supabase
      .from("notification_attachments")
      .select("storage_path, file_name")
      .eq("notification_id", record.id)
      .order("created_at", { ascending: true })
    const attachmentList: { storage_path: string; file_name: string | null }[] =
      attachmentRows && attachmentRows.length > 0
        ? attachmentRows
        : record.attachment_storage_path
        ? [{ storage_path: record.attachment_storage_path, file_name: record.attachment_file_name || null }]
        : []

    // Download and actually attach the bytes, up to the combined size cap -
    // over that, the email still lists every file by name, just without
    // the content, so it can never silently fail to send over a large batch
    // of attachments.
    const emailAttachments: { name: string; content: string }[] = []
    let totalBytes = 0
    let allAttached = true
    for (const item of attachmentList) {
      if (totalBytes >= MAX_EMAIL_ATTACHMENT_BYTES) { allAttached = false; break }
      const { data: fileBlob, error: downloadError } = await supabase.storage.from("message-attachments").download(item.storage_path)
      if (downloadError || !fileBlob) { allAttached = false; continue }
      const buffer = Buffer.from(await fileBlob.arrayBuffer())
      if (totalBytes + buffer.length > MAX_EMAIL_ATTACHMENT_BYTES) { allAttached = false; break }
      totalBytes += buffer.length
      emailAttachments.push({ name: item.file_name || "attachment", content: buffer.toString("base64") })
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin
    const attachmentNote = attachmentList.length === 0
      ? ""
      : allAttached
      ? `\n\nAttached: ${attachmentList.map((a) => a.file_name || "file").join(", ")}`
      : `\n\nThis message has ${attachmentList.length} attachment(s) (${attachmentList.map((a) => a.file_name || "file").join(", ")}) - sign in to HelpLift to view them.`

    await sendEmail({
      to: profile.email,
      subject: record.title,
      text: `${record.title}\n\n${record.message}${attachmentNote}\n\nView it on HelpLift: ${siteUrl}/login`,
      html: `
        <h2 style="font-family:sans-serif;margin:0 0 12px;">${escapeHtml(record.title)}</h2>
        <p style="font-family:sans-serif;white-space:pre-line;">${escapeHtml(record.message)}</p>
        ${attachmentNote ? `<p style="font-family:sans-serif;color:#475569;">${escapeHtml(attachmentNote.trim())}</p>` : ""}
        <p style="font-family:sans-serif;"><a href="${siteUrl}/login">View it on HelpLift</a></p>
      `,
      attachments: emailAttachments,
    })

    return NextResponse.json({ message: "Sent." }, { status: 200 })
  } catch (error) {
    console.error("Notification email webhook error:", error)
    return NextResponse.json({ message: "Failed to send notification email." }, { status: 500 })
  }
}
