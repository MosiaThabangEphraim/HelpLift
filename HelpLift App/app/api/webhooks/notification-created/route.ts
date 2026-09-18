import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { sendEmail, escapeHtml, isMailerConfigured } from "@/lib/mailer"

// Called by a Supabase Database Webhook configured on public.notifications
// (event: Insert). This has no end-user session — Supabase calls it
// server-to-server — so it's protected by a shared secret header instead of
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

    const record = body.record as { recipient_id: string; title: string; message: string } | undefined
    if (!record?.recipient_id || !record.title || !record.message) {
      return NextResponse.json({ message: "Malformed payload." }, { status: 400 })
    }

    if (!isMailerConfigured()) {
      console.warn("Notification email skipped — SMTP is not configured.")
      return NextResponse.json({ message: "Mailer not configured." }, { status: 200 })
    }

    const supabase = serviceClient()
    const { data: profile } = await supabase
      .from("profiles")
      .select("email, full_name")
      .eq("id", record.recipient_id)
      .single()
    if (!profile?.email) {
      console.warn("Notification email skipped — no profile/email for recipient", record.recipient_id)
      return NextResponse.json({ message: "Recipient has no email." }, { status: 200 })
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin
    await sendEmail({
      to: profile.email,
      subject: record.title,
      text: `${record.title}\n\n${record.message}\n\nView it on HelpLift: ${siteUrl}/login`,
      html: `
        <h2 style="font-family:sans-serif;margin:0 0 12px;">${escapeHtml(record.title)}</h2>
        <p style="font-family:sans-serif;white-space:pre-line;">${escapeHtml(record.message)}</p>
        <p style="font-family:sans-serif;"><a href="${siteUrl}/login">View it on HelpLift</a></p>
      `,
    })

    return NextResponse.json({ message: "Sent." }, { status: 200 })
  } catch (error) {
    console.error("Notification email webhook error:", error)
    return NextResponse.json({ message: "Failed to send notification email." }, { status: 500 })
  }
}
