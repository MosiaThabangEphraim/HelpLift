import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getBadgeThresholds } from "@/lib/platform-settings"
import { computeGiverBadges, syncBadgeAwards } from "@/lib/badges"

// Recomputes this giver's badges fresh from their own data every call (see
// lib/badges.ts) and records/notifies any newly-earned one. Reads run on the
// giver's own session - the same rows their dashboard already shows them -
// so no service-role client is needed here beyond what syncBadgeAwards uses
// internally for the ledger + notification writes.
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ message: "Authentication required." }, { status: 401 })

    const { data: profile } = await supabase.from("profiles").select("role, created_at").eq("id", user.id).single()
    if (profile?.role !== "giver") return NextResponse.json({ message: "Giver access required." }, { status: 403 })

    const { data: giver } = await supabase.from("givers").select("id").eq("profile_id", user.id).single()
    if (!giver) return NextResponse.json({ message: "Your giver profile could not be found." }, { status: 404 })

    const thresholds = await getBadgeThresholds(supabase)
    const computed = await computeGiverBadges(
      supabase,
      { giverId: giver.id, profileId: user.id, accountCreatedAt: profile.created_at },
      thresholds.giver
    )
    const badges = await syncBadgeAwards("giver", giver.id, user.id, computed)

    return NextResponse.json({ badges })
  } catch (error) {
    console.error("Giver badges error:", error)
    return NextResponse.json({ message: "Badges are unavailable." }, { status: 503 })
  }
}
