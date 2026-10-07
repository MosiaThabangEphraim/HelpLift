import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getOrgContext, roleAtLeast, insufficientRoleMessage } from "@/lib/organization-access"

// Lets an organization cancel its own withdrawal request while it's still
// pending. The database (prevent_withdrawal_tamper) enforces this is the
// only change an organization can ever make to a withdrawal row.
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ message: "Authentication required." }, { status: 401 })

    const ctx = await getOrgContext<{ id: string }>(supabase, user.id, "id")
    if (!ctx) return NextResponse.json({ message: "Organization profile not found." }, { status: 404 })
    if (!roleAtLeast(ctx.role, "manager")) return NextResponse.json({ message: insufficientRoleMessage(ctx.role, "manager") }, { status: 403 })

    const body = await request.json().catch(() => ({}))
    if (body.action !== "cancel") return NextResponse.json({ message: "Unsupported action." }, { status: 400 })

    const { id } = await context.params
    const { data: withdrawal, error } = await supabase
      .from("organization_withdrawals")
      .update({ status: "cancelled" })
      .eq("id", id)
      .eq("organization_id", ctx.organization.id)
      .select()
      .single()
    if (error) {
      // Either the tamper guard's own message (still fairly readable), or no
      // row matched at all because it's no longer pending (RLS silently
      // excludes it rather than raising) - either way, this is why.
      const message = /pending/i.test(error.message)
        ? error.message
        : "This request can no longer be cancelled - it has already been reviewed."
      return NextResponse.json({ message }, { status: 400 })
    }

    return NextResponse.json({ withdrawal })
  } catch (error) {
    console.error("Withdrawal cancel error:", error)
    return NextResponse.json({ message: "Could not cancel this withdrawal." }, { status: 503 })
  }
}
