import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getOrgContext } from "@/lib/organization-access"
import { getBadgeThresholds } from "@/lib/platform-settings"
import { computeOrganizationBadges, syncBadgeAwards } from "@/lib/badges"

// Recomputes this organization's badges fresh every call (see
// lib/badges.ts). Any team member may view them (read-only, same bar as the
// rest of the org dashboard) - the notification for a newly-earned badge
// always goes to the organization's primary profile_id, which the existing
// fan-out-to-team trigger copies to every other team member anyway (see
// 20260920000300_notify_whole_team.sql).
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ message: "Authentication required." }, { status: 401 })

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
    if (profile?.role !== "organization") return NextResponse.json({ message: "Organization access required." }, { status: 403 })

    const orgCtx = await getOrgContext<{ id: string; profile_id: string }>(supabase, user.id, "id, profile_id")
    const organization = orgCtx?.organization ?? null
    if (!organization) return NextResponse.json({ message: "Your organization profile could not be found." }, { status: 404 })

    const thresholds = await getBadgeThresholds(supabase)
    const computed = await computeOrganizationBadges(supabase, { organizationId: organization.id }, thresholds.organization)
    const badges = await syncBadgeAwards("organization", organization.id, organization.profile_id, computed)

    return NextResponse.json({ badges })
  } catch (error) {
    console.error("Organization badges error:", error)
    return NextResponse.json({ message: "Badges are unavailable." }, { status: 503 })
  }
}
