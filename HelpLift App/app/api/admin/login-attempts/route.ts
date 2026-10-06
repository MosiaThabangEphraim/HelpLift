import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireAdmin, retentionCutoff } from "@/lib/require-admin"

// Login activity for the admin Security tab (see 20261006000100_login_attempts.sql).
// ?result=all|failed|success  ?q=email, name or IP  ?days=1|7|30|90
// Also returns a 24-hour summary and the patterns worth a closer look:
// IP addresses and accounts with repeated failures.

const FAILED = ["wrong_password", "unknown_account", "locked", "account_locked_now", "two_factor_failed", "unlock_failed", "wrong_portal", "error"]
const SUCCESS = ["success", "two_factor_passed"]

export async function GET(request: Request) {
  try {
    const auth = await requireAdmin()
    if ("error" in auth) return auth.error
    const { supabase } = auth

    // Keep the log to 90 days (no scheduled job needed).
    await createAdminClient().from("login_attempts").delete().lt("created_at", retentionCutoff())

    const { searchParams } = new URL(request.url)
    const result = searchParams.get("result") || "all"
    const days = Math.min(90, Math.max(1, Number(searchParams.get("days")) || 7))
    const q = (searchParams.get("q") || "").trim().replace(/[,()%*\\]/g, " ").slice(0, 80)
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

    let query = supabase
      .from("login_attempts")
      .select("id, created_at, email, profile_id, outcome, method, portal, ip_address, country, city, device, user_agent, detail, profiles(full_name, role)")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(500)
    if (result === "failed") query = query.in("outcome", FAILED)
    if (result === "success") query = query.in("outcome", SUCCESS)
    if (q) query = query.or(`email.ilike.%${q}%,ip_address.ilike.%${q}%`)

    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const [{ data: attempts, error }, { data: lastDay }] = await Promise.all([
      query,
      supabase.from("login_attempts").select("outcome, ip_address, email").gte("created_at", dayAgo).limit(5000),
    ])
    if (error) return NextResponse.json({ message: error.message, attempts: [] }, { status: 400 })

    const recent = lastDay || []
    const failures = recent.filter(row => FAILED.includes(row.outcome))
    const countBy = (key: "ip_address" | "email") => {
      const counts = new Map<string, number>()
      for (const row of failures) if (row[key]) counts.set(row[key] as string, (counts.get(row[key] as string) || 0) + 1)
      return Array.from(counts.entries()).filter(([, count]) => count >= 3).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([value, count]) => ({ value, count }))
    }

    return NextResponse.json({
      attempts: attempts || [],
      summary: {
        successes: recent.filter(row => SUCCESS.includes(row.outcome)).length,
        failures: failures.length,
        lockouts: recent.filter(row => row.outcome === "account_locked_now").length,
        suspiciousIps: countBy("ip_address"),
        targetedAccounts: countBy("email"),
      },
    })
  } catch (error) {
    console.error("Admin login attempts error:", error)
    return NextResponse.json({ message: "Login activity is unavailable.", attempts: [] }, { status: 503 })
  }
}
