import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  previousMonthPeriod,
  periodLabel,
  ensureSpotlightFinalized,
  computeGiverCandidates,
  computeOrganizationCandidates,
} from "@/lib/spotlights"

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ message: "Authentication required." }, { status: 401 }) }
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
  if (profile?.role !== "admin") return { error: NextResponse.json({ message: "Administrator access required." }, { status: 403 }) }
  return {}
}

// Lets an admin see the automatically-computed "of the month" winner for a
// period (default: the one currently shown on the homepage) alongside the
// next few runners-up, and replace either winner if they want to. See
// lib/spotlights.ts for how the automatic winner itself is chosen.
export async function GET(request: Request) {
  try {
    const auth = await requireAdmin()
    if (auth.error) return auth.error

    const { searchParams } = new URL(request.url)
    const period = searchParams.get("period") || previousMonthPeriod()
    await ensureSpotlightFinalized(period)

    const admin = createAdminClient()
    const [{ data: rows }, giverCandidates, orgCandidates] = await Promise.all([
      admin.from("monthly_spotlights").select("subject_type, subject_id, metric_value, is_admin_override").eq("period", period),
      computeGiverCandidates(admin, period),
      computeOrganizationCandidates(admin, period),
    ])

    const giverRow = rows?.find((r) => r.subject_type === "giver") || null
    const orgRow = rows?.find((r) => r.subject_type === "organization") || null

    // The current pick's name/logo may not be in the top-5 candidates
    // (e.g. after an override to someone outside the automatic ranking),
    // so it's looked up directly rather than assumed to be in that list.
    const [giverCurrentInfo, orgCurrentInfo] = await Promise.all([
      giverRow ? admin.from("givers").select("name").eq("id", giverRow.subject_id).single() : Promise.resolve({ data: null }),
      orgRow ? admin.from("organizations").select("name, logo_url").eq("id", orgRow.subject_id).single() : Promise.resolve({ data: null }),
    ])

    return NextResponse.json({
      period,
      periodLabel: periodLabel(period),
      giver: {
        current: giverRow
          ? { subjectId: giverRow.subject_id, name: giverCurrentInfo.data?.name || "A giver", metric: Number(giverRow.metric_value), isOverride: giverRow.is_admin_override }
          : null,
        candidates: giverCandidates.slice(0, 5),
      },
      organization: {
        current: orgRow
          ? {
              subjectId: orgRow.subject_id,
              name: orgCurrentInfo.data?.name || "An organization",
              logoUrl: (orgCurrentInfo.data as any)?.logo_url || null,
              metric: Number(orgRow.metric_value),
              isOverride: orgRow.is_admin_override,
            }
          : null,
        candidates: orgCandidates.slice(0, 5),
      },
    })
  } catch (error) {
    console.error("Admin spotlights load error:", error)
    return NextResponse.json({ message: "Spotlights are unavailable." }, { status: 503 })
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireAdmin()
    if (auth.error) return auth.error

    const { period, subject_type, subject_id } = await request.json()
    if (!period || !["giver", "organization"].includes(subject_type) || !subject_id) {
      return NextResponse.json({ message: "Provide period, subject_type, and subject_id." }, { status: 400 })
    }

    const admin = createAdminClient()

    // Recompute the metric server-side rather than trust anything the
    // client sent - it's just used for display, but it should still
    // reflect this subject's real activity in the period, not an arbitrary
    // number. A subject with no qualifying activity that month is allowed
    // (metric 0) - an admin may want to recognize someone outside the
    // automatic ranking.
    const candidates = subject_type === "giver"
      ? await computeGiverCandidates(admin, period)
      : await computeOrganizationCandidates(admin, period)
    const match = candidates.find((c) => c.subjectId === subject_id)
    const metric = match?.metric ?? 0

    const table = subject_type === "giver" ? "givers" : "organizations"
    const { data: subject } = await admin.from(table).select("id").eq("id", subject_id).single()
    if (!subject) return NextResponse.json({ message: "That giver/organization could not be found." }, { status: 404 })

    const { error } = await admin.from("monthly_spotlights").upsert(
      { period, subject_type, subject_id, metric_value: metric, is_admin_override: true, updated_at: new Date().toISOString() },
      { onConflict: "period,subject_type" }
    )
    if (error) return NextResponse.json({ message: error.message }, { status: 400 })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Admin spotlights override error:", error)
    return NextResponse.json({ message: "Could not save this override." }, { status: 503 })
  }
}
