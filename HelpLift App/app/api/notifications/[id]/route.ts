import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function PATCH(_request: Request, context: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ message: "Authentication required." }, { status: 401 })
  const { id } = await context.params
  const { data, error } = await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id).select("id, read_at").single()
  if (error) return NextResponse.json({ message: error.message }, { status: 400 })
  return NextResponse.json({ notification: data })
}
