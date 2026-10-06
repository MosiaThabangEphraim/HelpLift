import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// The signed-in administrator's session client, or a ready-to-return error
// response - the same check every admin route does inline.
export async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ message: "Authentication required." }, { status: 401 }) } as const
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
  if (profile?.role !== "admin") return { error: NextResponse.json({ message: "Administrator access required." }, { status: 403 }) } as const
  return { supabase, user } as const
}

export const RETENTION_DAYS = 90

export function retentionCutoff() {
  return new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString()
}
