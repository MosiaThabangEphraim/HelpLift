import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

// Cached for five minutes so a busy landing page doesn't hit the database each visit.
export const revalidate = 300

// Anonymous visitors can't read most of these tables, so the counts come from the
// service-role client. Only totals are returned, never any rows or personal details.
export async function GET() {
  try {
    const admin = createAdminClient()
    const count = async (table: string, filter?: (q: any) => any) => {
      let query: any = admin.from(table).select("id", { count: "exact", head: true })
      if (filter) query = filter(query)
      const { count: total, error } = await query
      return error ? 0 : total ?? 0
    }

    const [organizations, givers, openNeeds, fulfilledNeeds, stories, donationCount, donationRows] = await Promise.all([
      count("organizations", q => q.eq("verification_status", "approved")),
      count("givers"),
      count("needs", q => q.in("status", ["open", "in_progress"])),
      count("needs", q => q.eq("status", "fulfilled")),
      count("impact_stories", q => q.eq("status", "approved")),
      count("donations", q => q.eq("status", "successful")),
      admin.from("donations").select("amount").eq("status", "successful").limit(50000),
    ])

    const totalDonated = (donationRows.data || []).reduce((sum: number, row: { amount: number | string | null }) => sum + (Number(row.amount) || 0), 0)

    return NextResponse.json({
      success: true,
      stats: { organizations, givers, openNeeds, fulfilledNeeds, stories, donationCount, totalDonated: Math.round(totalDonated) },
    })
  } catch (error) {
    console.error("Public stats error:", error)
    return NextResponse.json({ success: false, stats: null })
  }
}
