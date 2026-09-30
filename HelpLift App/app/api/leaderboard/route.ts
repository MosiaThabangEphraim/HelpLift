import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

// Top givers and organizations by badge count - shown from the Badges
// dialog on both the giver and organization dashboards (see
// components/badges-panel.tsx). Badges themselves are never stored (see
// lib/badges.ts - they're recomputed fresh every time), but badge_awards IS
// a permanent ledger of every badge ever earned, which makes it the right
// (and only cheap) source for a ranking - counting rows here is a lot
// cheaper than recomputing every giver's and organization's full badge set
// just to sort them.
//
// badge_awards has no client-facing RLS policy (see 20260927000200_badges.sql),
// so this reads it with the service-role client, same trust pattern as the
// badge-award writes themselves - the route only ever returns a name, an
// image and a count, never anything from the ledger's own rows.
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ message: "Authentication required." }, { status: 401 })

    const admin = createAdminClient()
    const { data: awardRows, error } = await admin.from("badge_awards").select("subject_type, subject_id")
    if (error) return NextResponse.json({ message: error.message }, { status: 400 })

    const giverCounts = new Map<string, number>()
    const orgCounts = new Map<string, number>()
    for (const row of awardRows || []) {
      const counts = row.subject_type === "giver" ? giverCounts : orgCounts
      counts.set(row.subject_id, (counts.get(row.subject_id) || 0) + 1)
    }

    // A wider candidate pool than the final top 10, so a few opted-out
    // givers (see spotlight_opt_out below) don't leave the list short.
    const topGiverCandidates = [...giverCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25)
    const topOrgCandidates = [...orgCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)

    const [{ data: giverRows }, { data: orgRows }] = await Promise.all([
      topGiverCandidates.length
        ? admin.from("givers").select("id, name, avatar_url, spotlight_opt_out").in("id", topGiverCandidates.map(([id]) => id))
        : Promise.resolve({ data: [] as any[] }),
      topOrgCandidates.length
        ? admin.from("organizations").select("id, name, logo_url").in("id", topOrgCandidates.map(([id]) => id))
        : Promise.resolve({ data: [] as any[] }),
    ])

    const giverById = new Map((giverRows || []).map((g: any) => [g.id, g]))
    const orgById = new Map((orgRows || []).map((o: any) => [o.id, o]))

    // Same privacy opt-out as "Giver of the Month" (20260928000200_giver_spotlight_opt_out.sql)
    // - a giver who doesn't want to be shown publicly with their name and
    // picture shouldn't be surfaced here either, for the same reason.
    const topGivers = topGiverCandidates
      .map(([id, badgeCount]) => {
        const giver = giverById.get(id)
        if (!giver || giver.spotlight_opt_out) return null
        return { name: giver.name, avatarUrl: giver.avatar_url || null, badgeCount }
      })
      .filter((entry): entry is { name: string; avatarUrl: string | null; badgeCount: number } => !!entry)
      .slice(0, 10)

    const topOrganizations = topOrgCandidates.map(([id, badgeCount]) => {
      const org = orgById.get(id)
      return { name: org?.name || "Organization", logoUrl: org?.logo_url || null, badgeCount }
    })

    return NextResponse.json({ topGivers, topOrganizations })
  } catch (error) {
    console.error("Leaderboard error:", error)
    return NextResponse.json({ message: "The leaderboard is unavailable right now." }, { status: 503 })
  }
}
