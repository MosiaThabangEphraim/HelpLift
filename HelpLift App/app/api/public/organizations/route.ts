import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// Directory of organizations. Only approved (verified) organizations are ever
// visible here: the database's row-level security shows other people's
// organizations to visitors only once an administrator has approved them, and
// this route adds no way around that.
//
// `message_recipient_id` (the profile a message is addressed to) is included only
// for signed-in callers, since only they can send messages.
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const { data: organizations, error } = await supabase
      .from("organizations")
      .select("id, name, type, city, province, mission, logo_url, verification_status, created_at, profile_id")
      .eq("verification_status", "approved")
      .order("name", { ascending: true })
    if (error) return NextResponse.json({ success: false, message: error.message, organizations: [] }, { status: 500 })

    // Activity: how many needs each organization currently has open.
    const openNeeds: Record<string, number> = {}
    try {
      const { data: needRows } = await supabase
        .from("needs")
        .select("organization_id")
        .in("status", ["open", "in_progress"])
      for (const row of needRows || []) openNeeds[row.organization_id] = (openNeeds[row.organization_id] || 0) + 1
    } catch (needsErr) {
      console.warn("Organization directory needs count warning:", needsErr)
    }

    const list = (organizations || []).map(({ profile_id, ...org }) => ({
      ...org,
      open_needs: openNeeds[org.id] || 0,
      ...(user ? { message_recipient_id: profile_id, is_own: profile_id === user.id } : {}),
    }))
    return NextResponse.json({ success: true, organizations: list, signedIn: !!user })
  } catch (error) {
    console.error("Organization directory error:", error)
    return NextResponse.json({ success: false, message: "Could not load organizations.", organizations: [] }, { status: 500 })
  }
}
