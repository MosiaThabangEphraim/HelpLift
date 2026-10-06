import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireAdmin } from "@/lib/require-admin"
import { escapeHtml, sendEmail } from "@/lib/mailer"
import { logActivity } from "@/lib/activity-log"

// Emails a reply (through Brevo, lib/mailer.ts) to the developer who sent a
// report - only possible when they chose to leave a contact email. Their
// response goes to the team inbox (CONTACT_EMAIL_TO) or, failing that, the
// admin who replied. The reply is noted on the report so every admin can see
// it was answered, and recorded in the activity log.

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAdmin()
    if ("error" in auth) return auth.error
    const { id } = await context.params

    const body = await request.json().catch(() => ({}))
    const subject = typeof body.subject === "string" ? body.subject.trim().slice(0, 200) : ""
    const message = typeof body.message === "string" ? body.message.trim().slice(0, 5000) : ""
    if (!subject) return NextResponse.json({ message: "Add a subject." }, { status: 400 })
    if (message.length < 5) return NextResponse.json({ message: "Write a message first." }, { status: 400 })

    const db = createAdminClient()
    const { data: report } = await db.from("developer_reports").select("id, title, contact_email, admin_notes").eq("id", id).maybeSingle()
    if (!report) return NextResponse.json({ message: "That report no longer exists." }, { status: 404 })
    if (!report.contact_email) return NextResponse.json({ message: "This report is anonymous - the sender didn't leave an email address." }, { status: 400 })

    const replyTo = process.env.CONTACT_EMAIL_TO || auth.user.email || undefined
    const intro = `Thank you for your report "${report.title}" on HelpLift's Developers page.`
    try {
      await sendEmail({
        to: report.contact_email,
        subject,
        replyTo,
        text: `Hi,\n\n${intro}\n\n${message}\n\n- The HelpLift team`,
        html: `
          <div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #0f172a; max-width: 560px;">
            <p>Hi,</p>
            <p>${escapeHtml(intro)}</p>
            <p style="white-space: pre-line;">${escapeHtml(message)}</p>
            <p>- The HelpLift team</p>
          </div>`,
      })
    } catch (mailError: any) {
      console.error("Developer report reply email error:", mailError)
      return NextResponse.json({ message: "The email couldn't be sent right now. Check the Brevo settings and try again." }, { status: 503 })
    }

    // Note the reply on the report for the rest of the team.
    const stamp = new Date().toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg", dateStyle: "medium", timeStyle: "short" })
    const note = `[${stamp}] Emailed a reply: "${subject}"`
    const adminNotes = report.admin_notes ? `${report.admin_notes}\n${note}` : note
    await db.from("developer_reports").update({ admin_notes: adminNotes, updated_at: new Date().toISOString() }).eq("id", id)
    await logActivity({ profileId: auth.user.id, role: "admin", action: "Replied to a developer report", detail: `"${report.title}"` })

    return NextResponse.json({ success: true, message: `Reply sent to ${report.contact_email}.`, admin_notes: adminNotes })
  } catch (error) {
    console.error("Developer report reply error:", error)
    return NextResponse.json({ message: "The reply couldn't be sent right now." }, { status: 503 })
  }
}
