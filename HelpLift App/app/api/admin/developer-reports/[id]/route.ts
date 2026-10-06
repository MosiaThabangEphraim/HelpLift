import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/require-admin"

// Update a developer report's status and/or the admins' internal notes.
const STATUSES = ["new", "reviewing", "planned", "fixed", "dismissed"]

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
    if (typeof body.admin_notes === "string") update.admin_notes = body.admin_notes.slice(0, 3000)

    const { data, error } = await auth.supabase.from("developer_reports").update(update).eq("id", id).select("id, status, admin_notes, updated_at").maybeSingle()
    if (error) return NextResponse.json({ message: error.message }, { status: 400 })
    if (!data) return NextResponse.json({ message: "Report not found." }, { status: 404 })
    return NextResponse.json({ report: data })
  } catch (error) {
    console.error("Admin developer report update error:", error)
    return NextResponse.json({ message: "Could not update the report." }, { status: 503 })
  }
}
