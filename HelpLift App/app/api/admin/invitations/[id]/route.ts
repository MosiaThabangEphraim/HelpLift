import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

// Cancels a pending admin invitation.
export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ message: "Authentication required." }, { status: 401 })
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
    if (profile?.role !== "admin") return NextResponse.json({ message: "Administrator access required." }, { status: 403 })

    const { id } = await context.params
    const { error } = await createAdminClient()
      .from("admin_invitations")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", id)
      .is("accepted_at", null)
    if (error) return NextResponse.json({ message: error.message }, { status: 400 })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Admin invitation revoke error:", error)
    return NextResponse.json({ message: "Could not cancel this invitation." }, { status: 503 })
  }
}
