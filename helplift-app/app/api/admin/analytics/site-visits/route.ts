import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { todayInSA } from "@/lib/expiry"

// Calendar dates in South African time (the database groups visits the same
// way - see 20261012000100_site_visits_sa_time.sql). Date arithmetic is done
// on a UTC-noon anchor of the SA date, so it never slips a day.
function saDate(offsetDays = 0, monthStart = false, monthOffset = 0) {
  const [y, m, d] = todayInSA().split("-").map(Number)
  const date = new Date(Date.UTC(y, m - 1 + monthOffset, monthStart ? 1 : d + offsetDays, 12))
  return date.toISOString().slice(0, 10)
}

// Daily/monthly site-visit stats for the admin Reports tab (see
// 20260928000600_site_visits.sql). The heavy lifting - counting visits and
// distinct visitors per day/month - happens in the database via
// admin_site_visit_daily/monthly, which both refuse outright unless the
// caller is an admin; the role check here is a first, cheaper gate before
// even attempting that.
//
// Query params (both optional, both YYYY-MM-DD): `from`/`to` scope the daily
// series - "today", or any other past date range. The monthly series always
// covers the last 12 calendar months, independent of that filter.
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ message: "Authentication required." }, { status: 401 })
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
    if (profile?.role !== "admin") return NextResponse.json({ message: "Administrator access required." }, { status: 403 })

    const url = new URL(request.url)
    const today = saDate()
    const defaultFrom = saDate(-29)
    const from = url.searchParams.get("from") || defaultFrom
    const to = url.searchParams.get("to") || today

    const monthsAgo = saDate(0, true, -11)
    const firstOfThisMonth = saDate(0, true)

    const [dailyRes, monthlyRes, todayRes, thisMonthRes] = await Promise.all([
      supabase.rpc("admin_site_visit_daily", { p_from: from, p_to: to }),
      supabase.rpc("admin_site_visit_monthly", { p_from: monthsAgo, p_to: today }),
      supabase.rpc("admin_site_visit_daily", { p_from: today, p_to: today }),
      supabase.rpc("admin_site_visit_monthly", { p_from: firstOfThisMonth, p_to: today }),
    ])

    for (const [label, res] of [["daily", dailyRes], ["monthly", monthlyRes], ["today", todayRes], ["thisMonth", thisMonthRes]] as const) {
      if (res.error) {
        const message = res.error.message.toLowerCase().includes("could not find the function")
          ? "Site-visit analytics aren't available yet: the site-visits database update hasn't been applied."
          : res.error.message
        console.warn(`admin site-visit ${label} warning:`, res.error.message)
        return NextResponse.json({ message }, { status: 501 })
      }
    }

    return NextResponse.json({
      today: todayRes.data?.[0] || { day: today, visits: 0, unique_visitors: 0 },
      thisMonth: thisMonthRes.data?.[0] || { month: firstOfThisMonth, visits: 0, unique_visitors: 0 },
      daily: dailyRes.data || [],
      monthly: monthlyRes.data || [],
    })
  } catch (error) {
    console.error("Admin site-visit analytics error:", error)
    return NextResponse.json({ message: "Site-visit analytics are unavailable right now." }, { status: 503 })
  }
}
