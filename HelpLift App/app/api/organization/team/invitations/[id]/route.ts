import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getOrgContext, roleAtLeast, insufficientRoleMessage } from "@/lib/organization-access"

// Revoke a pending invitation (owner only).
export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ message: "Authentication required." }, { status: 401 })
    const ctx = await getOrgContext(supabase, user.id)
    if (!ctx) return NextResponse.json({ message: "Organization profile not found." }, { status: 404 })
    if (!roleAtLeast(ctx.role, "owner")) return NextResponse.json({ message: insufficientRoleMessage(ctx.role, "owner") }, { status: 403 })

    const { id } = await context.params
    const admin = createAdminClient()
    const { error } = await admin
      .from("organization_invitations")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", id)
      .eq("organization_id", ctx.organization.id)
      .is("accepted_at", null)
    if (error) return NextResponse.json({ message: error.message }, { status: 400 })
    return NextResponse.json({ message: "Invitation revoked." })
  } catch (error) {
    console.error("Invitation revoke error:", error)
    return NextResponse.json({ message: "Could not revoke the invitation." }, { status: 503 })
  }
}
