import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getOrgContext, roleAtLeast, insufficientRoleMessage, INVITABLE_ROLES, ROLE_LABELS, type OrgRole } from "@/lib/organization-access"
import { generateInviteToken, INVITE_TTL_DAYS } from "@/lib/invitations"
import { sendEmail, escapeHtml, isMailerConfigured } from "@/lib/mailer"
import { isValidEmail } from "@/lib/password"

// Team management is owner-only. Reads/writes of the roster and invitations go
// through the service role (those tables have no write policies and invitations
// no read policies at all), so the owner check below is the authorization.
async function requireOwner() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ message: "Authentication required." }, { status: 401 }) }
  const ctx = await getOrgContext<{ id: string; name: string; profile_id: string }>(supabase, user.id, "id, name, profile_id")
  if (!ctx) return { error: NextResponse.json({ message: "Organization profile not found." }, { status: 404 }) }
  if (!roleAtLeast(ctx.role, "owner")) {
    return { error: NextResponse.json({ message: insufficientRoleMessage(ctx.role, "owner") }, { status: 403 }) }
  }
  return { user, organization: ctx.organization }
}

export async function GET() {
  try {
    const auth = await requireOwner()
    if (auth.error) return auth.error
    const admin = createAdminClient()

    const { data: members } = await admin
      .from("organization_members")
      .select("id, profile_id, role, created_at")
      .eq("organization_id", auth.organization.id)
      .order("created_at", { ascending: true })

    const ids = (members || []).map(m => m.profile_id)
    const { data: profiles } = ids.length
      ? await admin.from("profiles").select("id, full_name, email").in("id", ids)
      : { data: [] as { id: string; full_name: string | null; email: string | null }[] }
    const byId = new Map((profiles || []).map(p => [p.id, p]))

    const { data: invitations } = await admin
      .from("organization_invitations")
      .select("id, email, role, expires_at, created_at")
      .eq("organization_id", auth.organization.id)
      .is("accepted_at", null)
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })

    return NextResponse.json({
      members: (members || []).map(m => ({
        id: m.id,
        profile_id: m.profile_id,
        role: m.role,
        created_at: m.created_at,
        name: byId.get(m.profile_id)?.full_name || null,
        email: byId.get(m.profile_id)?.email || null,
        // The original account holder: protected from demotion/removal because
        // deleting that profile would cascade to the organization itself.
        is_primary: m.profile_id === auth.organization.profile_id,
        is_you: m.profile_id === auth.user.id,
      })),
      invitations: invitations || [],
    })
  } catch (error) {
    console.error("Team fetch error:", error)
    return NextResponse.json({ message: "Team information is unavailable." }, { status: 503 })
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireOwner()
    if (auth.error) return auth.error

    const body = await request.json().catch(() => ({}))
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : ""
    const role = body.role as OrgRole
    if (!email || !isValidEmail(email)) return NextResponse.json({ message: "Enter a valid email address." }, { status: 400 })
    if (!INVITABLE_ROLES.includes(role)) {
      return NextResponse.json({ message: `Role must be one of: ${INVITABLE_ROLES.join(", ")}.` }, { status: 400 })
    }

    const admin = createAdminClient()

    // Already on a team? (A profile can belong to only one organization.)
    const { data: existingProfile } = await admin.from("profiles").select("id").ilike("email", email).maybeSingle()
    if (existingProfile) {
      const { data: existingMember } = await admin.from("organization_members").select("organization_id").eq("profile_id", existingProfile.id).maybeSingle()
      if (existingMember?.organization_id === auth.organization.id) {
        return NextResponse.json({ message: "That person is already on your team." }, { status: 409 })
      }
      if (existingMember) {
        return NextResponse.json({ message: "That person already belongs to another organization." }, { status: 409 })
      }
    }

    // Replace any earlier pending invitation for the same email.
    await admin
      .from("organization_invitations")
      .update({ revoked_at: new Date().toISOString() })
      .eq("organization_id", auth.organization.id)
      .ilike("email", email)
      .is("accepted_at", null)
      .is("revoked_at", null)

    const { token, tokenHash } = generateInviteToken()
    const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000)
    const { error: insertError } = await admin.from("organization_invitations").insert({
      organization_id: auth.organization.id,
      email,
      role,
      token_hash: tokenHash,
      invited_by: auth.user.id,
      expires_at: expiresAt.toISOString(),
    })
    if (insertError) return NextResponse.json({ message: insertError.message }, { status: 400 })

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin
    const inviteUrl = `${siteUrl}/invite/${token}`

    let emailSent = false
    if (isMailerConfigured()) {
      try {
        const orgName = auth.organization.name
        await sendEmail({
          to: email,
          subject: `You're invited to join ${orgName} on HelpLift`,
          text: `You've been invited to join ${orgName} on HelpLift as a ${ROLE_LABELS[role].toLowerCase()}.\n\nAccept the invitation: ${inviteUrl}\n\nThis link expires in ${INVITE_TTL_DAYS} days. If you weren't expecting it, you can ignore this email.`,
          html: `
            <h2 style="font-family:sans-serif;margin:0 0 12px;">You're invited to join ${escapeHtml(orgName)}</h2>
            <p style="font-family:sans-serif;">You've been invited to join <strong>${escapeHtml(orgName)}</strong> on HelpLift as a <strong>${ROLE_LABELS[role].toLowerCase()}</strong>.</p>
            <p style="font-family:sans-serif;"><a href="${inviteUrl}" style="display:inline-block;padding:10px 18px;background:#2563eb;color:#fff;border-radius:8px;text-decoration:none;">Accept invitation</a></p>
            <p style="font-family:sans-serif;color:#64748b;font-size:13px;">This link expires in ${INVITE_TTL_DAYS} days. If you weren't expecting it, you can ignore this email.</p>
          `,
        })
        emailSent = true
      } catch (mailError) {
        console.warn("Invitation email failed:", mailError)
      }
    }

    // The link is returned to the owner as a fallback (e.g. email not configured
    // or delayed) so they can copy and send it themselves.
    return NextResponse.json({ email_sent: emailSent, invite_url: inviteUrl }, { status: 201 })
  } catch (error) {
    console.error("Team invite error:", error)
    return NextResponse.json({ message: "Invitations are unavailable." }, { status: 503 })
  }
}
