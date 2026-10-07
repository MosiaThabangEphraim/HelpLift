import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { previousMonthPeriod, periodLabel, ensureSpotlightFinalized } from "@/lib/spotlights"

// Public, unauthenticated - shown on the homepage next to Impact Stories.
// Always shows the most recently COMPLETED month (never "so far this
// month"), finalizing it on first request after that month ends. See
// lib/spotlights.ts / 20260928000100_monthly_spotlights.sql.
export async function GET() {
  try {
    const period = previousMonthPeriod()
    await ensureSpotlightFinalized(period)

    const admin = createAdminClient()
    const { data: rows } = await admin.from("monthly_spotlights").select("subject_type, subject_id, metric_value").eq("period", period)

    const giverRow = rows?.find((r) => r.subject_type === "giver") || null
    const orgRow = rows?.find((r) => r.subject_type === "organization") || null

    const [giverInfo, orgInfo] = await Promise.all([
      giverRow ? admin.from("givers").select("name, avatar_url").eq("id", giverRow.subject_id).single() : Promise.resolve({ data: null }),
      orgRow ? admin.from("organizations").select("name, logo_url").eq("id", orgRow.subject_id).single() : Promise.resolve({ data: null }),
    ])

    return NextResponse.json({
      period,
      periodLabel: periodLabel(period),
      giver: giverRow && giverInfo.data
        ? { name: giverInfo.data.name, avatarUrl: (giverInfo.data as any).avatar_url || null, needsSupported: Number(giverRow.metric_value) }
        : null,
      organization: orgRow && orgInfo.data
        ? { id: orgRow.subject_id, name: orgInfo.data.name, logoUrl: orgInfo.data.logo_url || null, needsFulfilled: Number(orgRow.metric_value) }
        : null,
    })
  } catch (error) {
    console.error("Public spotlights error:", error)
    return NextResponse.json({ period: null, periodLabel: null, giver: null, organization: null }, { status: 200 })
  }
}
