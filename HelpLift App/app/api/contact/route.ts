import { NextResponse } from "next/server"
import { sendEmail, escapeHtml } from "@/lib/mailer"
import { createClient } from "@/lib/supabase/server"

/**
 * Sends "Partner with us" contact form submissions (home page) via
 * lib/mailer.ts (Brevo's HTTP API — see that file for why not SMTP).
 *
 * This is intentionally separate from Supabase Auth's SMTP configuration
 * (Dashboard > Project Settings > Auth > SMTP Settings) — that config is
 * used exclusively by Supabase's own GoTrue service to send its fixed set
 * of auth emails (signup confirmation, password reset, magic link, email
 * change) and isn't exposed as a general-purpose "send an email" API. There
 * is no supabase-js call that routes an arbitrary message through it.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const email = typeof body.email === "string" ? body.email.trim() : ""
    const message = typeof body.message === "string" ? body.message.trim() : ""

    if (!email || !message) {
      return NextResponse.json({ success: false, message: "Email and message are required." }, { status: 400 })
    }
    const basicEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!basicEmail.test(email)) {
      return NextResponse.json({ success: false, message: "Please enter a valid email address." }, { status: 400 })
    }
    if (message.length > 5000) {
      return NextResponse.json({ success: false, message: "Message is too long." }, { status: 400 })
    }

    try {
      const supabase = await createClient()
      const { error: rpcError } = await supabase.rpc("add_contact_inquiry", { p_email: email, p_message: message })
      if (rpcError) console.warn("Contact inquiry notification warning:", rpcError.message)
    } catch (notifyErr) {
      console.warn("Contact inquiry notification warning:", notifyErr)
    }

    const { CONTACT_EMAIL_TO } = process.env
    if (!CONTACT_EMAIL_TO) {
      console.error("Contact form: CONTACT_EMAIL_TO is not configured.")
      return NextResponse.json({ success: false, message: "Contact form is not configured yet. Please email us directly." }, { status: 503 })
    }

    await sendEmail({
      to: CONTACT_EMAIL_TO,
      replyTo: email,
      subject: "New HelpLift partnership inquiry",
      text: `New message from the HelpLift "Partner with us" form.\n\nFrom: ${email}\n\nMessage:\n${message}`,
      html: `
        <p><strong>New message from the HelpLift "Partner with us" form.</strong></p>
        <p><strong>From:</strong> ${escapeHtml(email)}</p>
        <p><strong>Message:</strong></p>
        <p style="white-space:pre-line">${escapeHtml(message)}</p>
      `,
    })

    return NextResponse.json({ success: true, message: "Thanks! Your message has been sent — we'll get back to you soon." })
  } catch (error) {
    console.error("Contact form send error:", error)
    return NextResponse.json({ success: false, message: "Unable to send your message right now. Please try again later." }, { status: 503 })
  }
}
