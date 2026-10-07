import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// Housekeeping only - a fulfillment still 'pending' or 'in_progress' is a
// giver actively delivering on a commitment; deleting that out from under
// them isn't an admin's call. Only once it's actually done (completed or
// cancelled) is this a historical record an admin can clear out.
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ message: "Authentication required." }, { status: 401 })
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
    if (profile?.role !== "admin") return NextResponse.json({ message: "Administrator access required." }, { status: 403 })

    const { id } = await context.params
    const { data: existing } = await supabase.from("fulfillments").select("id, status").eq("id", id).single()
    if (!existing) return NextResponse.json({ message: "Fulfillment not found." }, { status: 404 })
    if (existing.status !== "completed" && existing.status !== "cancelled") {
      return NextResponse.json({ message: "Only a completed or cancelled fulfillment can be deleted this way." }, { status: 400 })
    }

    const { error } = await supabase.from("fulfillments").delete().eq("id", id)
    if (error) return NextResponse.json({ message: error.message }, { status: 400 })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Admin fulfillment delete error:", error)
    return NextResponse.json({ message: "Fulfillment deletion is unavailable." }, { status: 503 })
  }
}
