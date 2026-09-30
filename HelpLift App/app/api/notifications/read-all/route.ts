import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// Marks every one of the caller's own still-unread notifications as read in
// one call, for the "Mark all as read" option in the notifications dropdown.
export async function PATCH() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ message: "Authentication required." }, { status: 401 })

  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("recipient_id", user.id)
    .is("read_at", null)
  if (error) return NextResponse.json({ message: error.message }, { status: 400 })

  return NextResponse.json({ success: true })
}
