import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { generateInviteToken, INVITE_TTL_DAYS } from "@/lib/invitations"
import { sendEmail, escapeHtml, isMailerConfigured } from "@/lib/mailer"
import { isValidEmail } from "@/lib/password"

// Inviting new administrators is admin-only. Reads/writes of admin_invitations
// go through the service role (the table has no RLS policies at all), so this
// check is the authorization.
async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ message: "Authentication required." }, { status: 401 }) }
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
  if (profile?.role !== "admin") return { error: NextResponse.json({ message: "Administrator access required." }, { status: 403 }) }
  return { user }
}

export async function GET() {
  try {
    const auth = await requireAdmin()
    if (auth.error) return auth.error
    const admin = createAdminClient()
    const { data: invitations } = await admin
      .from("admin_invitations")
      .select("id, email, expires_at, created_at")
      .is("accepted_at", null)
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
    return NextResponse.json({ invitations: invitations || [] })
  } catch (error) {
    console.error("Admin invitations fetch error:", error)
    return NextResponse.json({ message: "Invitations are unavailable." }, { status: 503 })
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAdmin()
    if (auth.error) return auth.error

    const body = await request.json().catch(() => ({}))
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : ""
    if (!email || !isValidEmail(email)) return NextResponse.json({ message: "Enter a valid email address." }, { status: 400 })

    const admin = createAdminClient()

    const { data: existingProfile } = await admin.from("profiles").select("role").ilike("email", email).maybeSingle()
    if (existingProfile?.role === "admin") {
      return NextResponse.json({ message: "That person is already an administrator." }, { status: 409 })
    }

    // Replace any earlier pending invitation for the same email.
    await admin
      .from("admin_invitations")
      .update({ revoked_at: new Date().toISOString() })
      .ilike("email", email)
      .is("accepted_at", null)
      .is("revoked_at", null)

    const { token, tokenHash } = generateInviteToken()
    const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000)
    const { error: insertError } = await admin.from("admin_invitations").insert({
      email,
      token_hash: tokenHash,
      invited_by: auth.user.id,
      expires_at: expiresAt.toISOString(),
    })
    if (insertError) return NextResponse.json({ message: insertError.message }, { status: 400 })

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin
    const inviteUrl = `${siteUrl}/admin-invite/${token}`

    let emailSent = false
    if (isMailerConfigured()) {
      try {
        await sendEmail({
          to: email,
          subject: "You're invited to administer HelpLift",
          text: `You've been invited to become a HelpLift administrator.\n\nAccept the invitation: ${inviteUrl}\n\nThis link expires in ${INVITE_TTL_DAYS} days. If you weren't expecting it, you can ignore this email.`,
          html: `
            <h2 style="font-family:sans-serif;margin:0 0 12px;">You're invited to administer HelpLift</h2>
            <p style="font-family:sans-serif;">You've been invited to become a <strong>HelpLift administrator</strong>, with full access to the moderation dashboard.</p>
            <p style="font-family:sans-serif;"><a href="${inviteUrl}" style="display:inline-block;padding:10px 18px;background:#2563eb;color:#fff;border-radius:8px;text-decoration:none;">Accept invitation</a></p>
            <p style="font-family:sans-serif;color:#64748b;font-size:13px;">This link expires in ${INVITE_TTL_DAYS} days. If you weren't expecting it, you can ignore this email.</p>
          `,
        })
        emailSent = true
      } catch (mailError) {
        console.warn("Admin invitation email failed:", mailError)
      }
    }

    // Returned as a fallback (email not configured or delayed) so the admin can copy and send it themselves.
    return NextResponse.json({ email_sent: emailSent, invite_url: inviteUrl }, { status: 201 })
  } catch (error) {
    console.error("Admin invite error:", error)
    return NextResponse.json({ message: "Invitations are unavailable." }, { status: 503 })
  }
}
