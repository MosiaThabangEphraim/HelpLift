import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { INVITABLE_ROLES, ROLE_LABELS, type OrgRole } from "@/lib/organization-access"

// Lets an administrator see and change a person's role inside their organization
// (owner / manager / viewer). Platform roles (admin / giver) are changed through
// PATCH /api/admin/users/[id].

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ message: "Authentication required." }, { status: 401 }), user: null }
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
  if (profile?.role !== "admin") return { error: NextResponse.json({ message: "Administrator access required." }, { status: 403 }), user: null }
  return { error: null, user }
}

async function loadMembership(admin: ReturnType<typeof createAdminClient>, profileId: string) {
  const { data } = await admin
    .from("organization_members")
    .select("organization_id, role, organizations(name, profile_id)")
    .eq("profile_id", profileId)
    .maybeSingle()
  if (!data) return null
  const org: any = Array.isArray((data as any).organizations) ? (data as any).organizations[0] : (data as any).organizations
  return {
    organization_id: data.organization_id as string,
    role: data.role as OrgRole,
    organization_name: (org?.name as string) ?? "Organization",
    is_primary_owner: org?.profile_id === profileId,
  }
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { error } = await requireAdmin()
    if (error) return error
    const { id } = await context.params
    return NextResponse.json({ membership: await loadMembership(createAdminClient(), id) })
  } catch (err) {
    console.error("Admin team role lookup error:", err)
    return NextResponse.json({ membership: null })
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { error, user } = await requireAdmin()
    if (error || !user) return error!
    const { id } = await context.params
    const { role } = await request.json()
    if (!INVITABLE_ROLES.includes(role)) return NextResponse.json({ message: "Role must be owner, manager or viewer." }, { status: 400 })

    const admin = createAdminClient()
    const membership = await loadMembership(admin, id)
    if (!membership) return NextResponse.json({ message: "This person is not a member of an organization." }, { status: 404 })
    if (membership.role === role) return NextResponse.json({ membership })

    if (membership.is_primary_owner && role !== "owner") {
      return NextResponse.json({ message: "The organization's primary owner must stay an owner." }, { status: 400 })
    }
    if (membership.role === "owner" && role !== "owner") {
      const { count } = await admin
        .from("organization_members")
        .select("profile_id", { count: "exact", head: true })
        .eq("organization_id", membership.organization_id)
        .eq("role", "owner")
      if ((count ?? 0) <= 1) return NextResponse.json({ message: "An organization must keep at least one owner." }, { status: 400 })
    }

    const { error: updateError } = await admin
      .from("organization_members")
      .update({ role })
      .eq("organization_id", membership.organization_id)
      .eq("profile_id", id)
    if (updateError) return NextResponse.json({ message: updateError.message }, { status: 400 })

    await admin.from("notifications").insert({
      recipient_id: id,
      sender_id: user.id,
      sender_name: "HelpLift Notifications",
      type: "team_role_changed",
      title: "Your organization role changed",
      message: `An administrator changed your role in ${membership.organization_name} from ${ROLE_LABELS[membership.role]} to ${ROLE_LABELS[role as OrgRole]}.`,
    })

    return NextResponse.json({ membership: { ...membership, role } })
  } catch (err: any) {
    console.error("Admin team role update error:", err)
    return NextResponse.json({ message: err?.message || "Role update is unavailable." }, { status: 503 })
  }
}
