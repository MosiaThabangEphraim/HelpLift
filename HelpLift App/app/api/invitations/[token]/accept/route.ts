import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { lookupInvitation } from "@/lib/invitations"

// An already-registered organization-role user accepts an invitation. The
// signed-in email must match the invited email, so a forwarded link is useless
// to anyone else.
export async function POST(_request: Request, context: { params: Promise<{ token: string }> }) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ message: "Sign in to accept this invitation." }, { status: 401 })

    const { token } = await context.params
    const admin = createAdminClient()
    const invite = await lookupInvitation(admin, token)
    if (!invite) return NextResponse.json({ message: "This invitation link isn't valid." }, { status: 404 })
    if (invite.status !== "valid") {
      const reason = invite.status === "accepted" ? "already been used" : invite.status === "revoked" ? "been cancelled" : "expired"
      return NextResponse.json({ message: `This invitation has ${reason}.` }, { status: 410 })
    }

    if (user.email?.toLowerCase() !== invite.email.toLowerCase()) {
      return NextResponse.json({ message: `This invitation was sent to ${invite.email}. Sign in with that email to accept it.` }, { status: 403 })
    }

    const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single()
    if (profile?.role !== "organization") {
      return NextResponse.json({ message: "This email is registered as a giver or admin account, which can't join an organization team. Ask for the invitation to be sent to a different email address." }, { status: 403 })
    }

    const { data: existing } = await admin.from("organization_members").select("organization_id").eq("profile_id", user.id).maybeSingle()
    if (existing && existing.organization_id !== invite.organization_id) {
      return NextResponse.json({ message: "You already belong to another organization." }, { status: 409 })
    }

    if (!existing) {
      const { error: insertError } = await admin.from("organization_members").insert({
        organization_id: invite.organization_id,
        profile_id: user.id,
        role: invite.role,
      })
      if (insertError) return NextResponse.json({ message: insertError.message }, { status: 400 })
    }

    await admin.from("organization_invitations").update({ accepted_at: new Date().toISOString() }).eq("id", invite.id)
    return NextResponse.json({ message: "You've joined the team." })
  } catch (error) {
    console.error("Invitation accept error:", error)
    return NextResponse.json({ message: "Could not accept the invitation." }, { status: 503 })
  }
}
