import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getOrgContext, roleAtLeast, insufficientRoleMessage, INVITABLE_ROLES } from "@/lib/organization-access"
import { transferMemberDocuments } from "@/lib/organization-team"

// Change a member's role, or remove them. Owner only. An organization may have
// any number of owners, managers and viewers; owners can promote/demote anyone
// except the original account holder (organizations.profile_id), who is
// protected because deleting that profile cascades to the organization itself.
// That protection also guarantees the organization always keeps an owner.
async function authorize(memberId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ message: "Authentication required." }, { status: 401 }) }
  const ctx = await getOrgContext<{ id: string; profile_id: string }>(supabase, user.id, "id, profile_id")
  if (!ctx) return { error: NextResponse.json({ message: "Organization profile not found." }, { status: 404 }) }
  if (!roleAtLeast(ctx.role, "owner")) {
    return { error: NextResponse.json({ message: insufficientRoleMessage(ctx.role, "owner") }, { status: 403 }) }
  }
  const admin = createAdminClient()
  const { data: member } = await admin
    .from("organization_members")
    .select("id, role, profile_id")
    .eq("id", memberId)
    .eq("organization_id", ctx.organization.id)
    .maybeSingle()
  if (!member) return { error: NextResponse.json({ message: "Team member not found." }, { status: 404 }) }
  if (member.profile_id === ctx.organization.profile_id) {
    return { error: NextResponse.json({ message: "The original account holder can't be demoted or removed." }, { status: 400 }) }
  }
  return { admin, member, user, organization: ctx.organization }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const auth = await authorize(id)
    if (auth.error) return auth.error
    const { role } = await request.json().catch(() => ({}))
    if (!INVITABLE_ROLES.includes(role)) {
      return NextResponse.json({ message: `Role must be one of: ${INVITABLE_ROLES.join(", ")}.` }, { status: 400 })
    }
    const { error } = await auth.admin.from("organization_members").update({ role }).eq("id", id)
    if (error) return NextResponse.json({ message: error.message }, { status: 400 })
    return NextResponse.json({ message: "Role updated." })
  } catch (error) {
    console.error("Member role update error:", error)
    return NextResponse.json({ message: "Could not update the role." }, { status: 503 })
  }
}

// Removing a member deletes their HelpLift account permanently (auth user ->
// profile -> membership all cascade), not just their access to the
// organization. Documents they uploaded for the organization are handed to the
// removing owner first so they survive.
export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const auth = await authorize(id)
    if (auth.error) return auth.error
    if (auth.member.profile_id === auth.user.id) {
      return NextResponse.json({ message: "You can't remove yourself. Ask another owner to remove you, or delete your account from settings." }, { status: 400 })
    }

    const transferError = await transferMemberDocuments(auth.admin, auth.organization.id, auth.member.profile_id, auth.user.id)
    if (transferError) return NextResponse.json({ message: transferError }, { status: 500 })

    const { error } = await auth.admin.auth.admin.deleteUser(auth.member.profile_id)
    if (error) return NextResponse.json({ message: error.message }, { status: 400 })

    return NextResponse.json({ message: "Member removed and their account deleted." })
  } catch (error) {
    console.error("Member removal error:", error)
    return NextResponse.json({ message: "Could not remove the member." }, { status: 503 })
  }
}
