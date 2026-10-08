import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/require-admin"
import { TIP_OFF_STATUSES } from "@/lib/tip-offs"

// Update a tip-off's investigation status and/or the admins' internal notes.
const STATUSES: string[] = TIP_OFF_STATUSES.map(status => status.value)

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAdmin()
    if ("error" in auth) return auth.error
    const { id } = await context.params

    const body = await request.json().catch(() => ({}))
    const update: Record<string, string> = { updated_at: new Date().toISOString() }
    if (typeof body.status === "string") {
      if (!STATUSES.includes(body.status)) return NextResponse.json({ message: "Invalid status." }, { status: 400 })
      update.status = body.status
    }
    if (typeof body.admin_notes === "string") update.admin_notes = body.admin_notes.slice(0, 5000)

    const { data, error } = await auth.supabase.from("tip_offs").update(update).eq("id", id).select("id, status, admin_notes, updated_at").maybeSingle()
    if (error) return NextResponse.json({ message: error.message }, { status: 400 })
    if (!data) return NextResponse.json({ message: "Tip-off not found." }, { status: 404 })
    return NextResponse.json({ tipOff: data })
  } catch (error) {
    console.error("Admin tip-off update error:", error)
    return NextResponse.json({ message: "Could not update the tip-off." }, { status: 503 })
  }
}
