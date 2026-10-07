import type { SupabaseClient } from "@supabase/supabase-js"
import { createAdminClient } from "@/lib/supabase/admin"

// "Giver of the Month" / "Organization of the Month" - see
// 20260928000100_monthly_spotlights.sql for why this is a persisted
// snapshot rather than computed live like badges. Criteria: the giver who
// supported the most distinct needs in the month, and the organization
// that had the most needs reach "fulfilled" in the month (an organization's
// needs.updated_at is used as a "became fulfilled" proxy - needs aren't
// normally edited again once fulfilled, but this is an approximation, not a
// dedicated timestamp).

export type SpotlightCandidate = { subjectId: string; name: string; metric: number; logoUrl?: string | null }

function periodKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
}

// The most recently COMPLETED calendar month relative to `date` - a
// spotlight only ever celebrates a closed period, never "so far this
// month," so the winner never changes once shown.
export function previousMonthPeriod(date: Date = new Date()): string {
  const d = new Date(date.getFullYear(), date.getMonth(), 1)
  d.setMonth(d.getMonth() - 1)
  return periodKey(d)
}

export function periodBounds(period: string): { start: Date; end: Date } {
  const [y, m] = period.split("-").map(Number)
  const start = new Date(y, m - 1, 1)
  const end = new Date(y, m, 1)
  return { start, end }
}

export function periodLabel(period: string): string {
  const { start } = periodBounds(period)
  return start.toLocaleDateString("en-US", { month: "long", year: "numeric" })
}

// --- Candidate ranking (global - across every giver/organization) ---

export async function computeGiverCandidates(supabase: SupabaseClient, period: string): Promise<SpotlightCandidate[]> {
  const { start, end } = periodBounds(period)
  const { data: rows } = await supabase
    .from("donations")
    .select("giver_id, need_id")
    .eq("status", "successful")
    .not("giver_id", "is", null)
    .not("need_id", "is", null)
    .gte("created_at", start.toISOString())
    .lt("created_at", end.toISOString())

  const needsByGiver = new Map<string, Set<string>>()
  for (const row of rows || []) {
    if (!row.giver_id || !row.need_id) continue
    if (!needsByGiver.has(row.giver_id)) needsByGiver.set(row.giver_id, new Set())
    needsByGiver.get(row.giver_id)!.add(row.need_id)
  }
  if (needsByGiver.size === 0) return []

  const giverIds = [...needsByGiver.keys()]
  const { data: givers } = await supabase.from("givers").select("id, name, spotlight_opt_out").in("id", giverIds)
  // Excluded from the candidate pool entirely - not just skipped as the
  // winner - so an opted-out giver can never surface even as a runner-up
  // an admin could pick (see 20260928000200_giver_spotlight_opt_out.sql).
  const eligible = new Map((givers || []).filter((g: any) => !g.spotlight_opt_out).map((g: any) => [g.id, g.name]))

  return [...eligible.keys()]
    .map((id) => ({ subjectId: id, name: eligible.get(id) || "A giver", metric: needsByGiver.get(id)!.size }))
    .sort((a, b) => b.metric - a.metric)
}

export async function computeOrganizationCandidates(supabase: SupabaseClient, period: string): Promise<SpotlightCandidate[]> {
  const { start, end } = periodBounds(period)
  const { data: rows } = await supabase
    .from("needs")
    .select("organization_id")
    .eq("status", "fulfilled")
    .gte("updated_at", start.toISOString())
    .lt("updated_at", end.toISOString())

  const countByOrg = new Map<string, number>()
  for (const row of rows || []) {
    if (!row.organization_id) continue
    countByOrg.set(row.organization_id, (countByOrg.get(row.organization_id) || 0) + 1)
  }
  if (countByOrg.size === 0) return []

  const orgIds = [...countByOrg.keys()]
  const { data: orgs } = await supabase.from("organizations").select("id, name, logo_url").in("id", orgIds)
  const infoById = new Map((orgs || []).map((o: any) => [o.id, o]))

  return orgIds
    .map((id) => ({ subjectId: id, name: infoById.get(id)?.name || "An organization", metric: countByOrg.get(id)!, logoUrl: infoById.get(id)?.logo_url || null }))
    .sort((a, b) => b.metric - a.metric)
}

// Computes and stores a period's winner the first time it's asked for - a
// period with no qualifying activity at all is left unset (no row), so the
// homepage can simply skip that category rather than show an empty winner.
export async function ensureSpotlightFinalized(period: string) {
  const admin = createAdminClient()
  const { data: existing } = await admin.from("monthly_spotlights").select("subject_type").eq("period", period)
  const have = new Set((existing || []).map((r: any) => r.subject_type))

  if (!have.has("giver")) {
    const candidates = await computeGiverCandidates(admin, period)
    if (candidates[0]) {
      await admin.from("monthly_spotlights").upsert(
        { period, subject_type: "giver", subject_id: candidates[0].subjectId, metric_value: candidates[0].metric },
        { onConflict: "period,subject_type" }
      )
    }
  }
  if (!have.has("organization")) {
    const candidates = await computeOrganizationCandidates(admin, period)
    if (candidates[0]) {
      await admin.from("monthly_spotlights").upsert(
        { period, subject_type: "organization", subject_id: candidates[0].subjectId, metric_value: candidates[0].metric },
        { onConflict: "period,subject_type" }
      )
    }
  }
}
