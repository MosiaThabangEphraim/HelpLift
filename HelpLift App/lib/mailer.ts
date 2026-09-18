// Shared email sender — used by the contact form (api/contact) and the
// notification-email webhook (api/webhooks/notification-created).
//
// This calls Brevo's transactional email HTTP API directly (over HTTPS/443)
// rather than SMTP. We switched from SMTP after discovering the dev network
// blocks outbound SMTP ports (587 and 465 both timed out with ETIMEDOUT) —
// a common restriction on ISPs/campus networks and some hosting platforms.
// The HTTP API sends over plain HTTPS, which isn't subject to that.
//
// This is unrelated to Supabase Auth's own SMTP config (Dashboard > Project
// Settings > Auth > SMTP Settings), which only sends Supabase's fixed auth
// emails and runs from Supabase's own servers, not ours.
const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email"

export function isMailerConfigured() {
  return Boolean(process.env.BREVO_API_KEY && process.env.SMTP_FROM)
}

// Parses "Display Name <email@example.com>" (with or without quotes around
// the name) or a bare "email@example.com" into Brevo's {name, email} shape.
function parseFrom(from: string): { name?: string; email: string } {
  const match = from.match(/^\s*"?([^"<]*?)"?\s*<([^<>]+)>\s*$/)
  if (match) {
    const name = match[1].trim()
    return { name: name || undefined, email: match[2].trim() }
  }
  return { email: from.trim() }
}

export async function sendEmail(options: {
  to: string
  subject: string
  text: string
  html: string
  replyTo?: string
  /** Brevo wants attachment content as base64 (no data: URI prefix). */
  attachments?: { name: string; content: string }[]
}) {
  const apiKey = process.env.BREVO_API_KEY
  const fromRaw = process.env.SMTP_FROM
  if (!apiKey || !fromRaw) {
    throw new Error("Brevo is not configured (BREVO_API_KEY/SMTP_FROM).")
  }

  const res = await fetch(BREVO_API_URL, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify({
      sender: parseFrom(fromRaw),
      to: [{ email: options.to }],
      subject: options.subject,
      textContent: options.text,
      htmlContent: options.html,
      ...(options.replyTo ? { replyTo: { email: options.replyTo } } : {}),
      ...(options.attachments?.length ? { attachment: options.attachments } : {}),
    }),
  })

  if (!res.ok) {
    const errorBody = await res.text().catch(() => "")
    throw new Error(`Brevo API error (${res.status}): ${errorBody}`)
  }
}

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}
