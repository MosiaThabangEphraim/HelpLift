import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { lookupInvitation } from "@/lib/invitations"

// Public: the invite page calls this before anyone is signed in. The token is
// the credential (256-bit random), so possessing it entitles the caller to see
// which organization/role/email it is for and whether that email already has an
// account (so the page can offer "sign in" vs "create account").
export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await context.params
    const admin = createAdminClient()
    const invite = await lookupInvitation(admin, token)
    if (!invite) return NextResponse.json({ message: "This invitation link isn't valid." }, { status: 404 })

    const { data: profile } = await admin.from("profiles").select("id, role").ilike("email", invite.email).maybeSingle()

    return NextResponse.json({
      organization_name: invite.organization_name,
      email: invite.email,
      role: invite.role,
      status: invite.status,
      account_exists: !!profile,
      account_role: profile?.role ?? null,
    })
  } catch (error) {
    console.error("Invitation lookup error:", error)
    return NextResponse.json({ message: "Could not load this invitation." }, { status: 503 })
  }
}
