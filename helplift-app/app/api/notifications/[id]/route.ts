import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function PATCH(_request: Request, context: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ message: "Authentication required." }, { status: 401 })
  const { id } = await context.params
  // Reading it implies it was delivered - stamp both together so a message
  // can't end up "read" without ever showing as "delivered" first.
  const now = new Date().toISOString()
  const { data, error } = await supabase.from("notifications").update({ read_at: now, delivered_at: now }).eq("id", id).select("id, read_at, delivered_at").single()
  if (error) return NextResponse.json({ message: error.message }, { status: 400 })
  return NextResponse.json({ notification: data })
}
