import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireAdmin, retentionCutoff } from "@/lib/require-admin"
import { logUserAction } from "@/lib/activity-log"

// Live system activity for the admin Live activity tab (see
// 20261006000200_activity_tracking.sql): who's online now and the latest
// page views/actions. ?profile=<id> returns one user's timeline instead.
// ?kind=all|action|page_view  ?role=all|giver|organization|admin
// ?from=<ISO time>&to=<ISO time> limits it to a date/time range.
// DELETE clears the whole log.

const ONLINE_WINDOW_MS = 3 * 60 * 1000 // heartbeat is every minute; allow a couple of misses

function validTime(value: string | null) {
  if (!value) return null
  const time = new Date(value)
  return Number.isNaN(time.getTime()) ? null : time.toISOString()
}

export async function GET(request: Request) {
  try {
    const auth = await requireAdmin()
    if ("error" in auth) return auth.error
    const { supabase } = auth

    // Keep the history to 90 days (no scheduled job needed).
    await createAdminClient().from("activity_events").delete().lt("created_at", retentionCutoff())

    const { searchParams } = new URL(request.url)
    const profileId = searchParams.get("profile")
    const kind = searchParams.get("kind") || "all"
    const role = searchParams.get("role") || "all"
    const from = validTime(searchParams.get("from"))
    const to = validTime(searchParams.get("to"))

    let events = supabase
      .from("activity_events")
      .select("id, created_at, profile_id, role, kind, action, path, detail, profiles(full_name, email, role)")
      .order("created_at", { ascending: false })
      .limit(profileId ? 300 : 150)
    if (profileId) events = events.eq("profile_id", profileId)
    if (kind === "action" || kind === "page_view") events = events.eq("kind", kind)
    if (["giver", "organization", "admin"].includes(role)) events = events.eq("role", role)
    if (from) events = events.gte("created_at", from)
    if (to) events = events.lte("created_at", to)

    const onlineSince = new Date(Date.now() - ONLINE_WINDOW_MS).toISOString()
    const [{ data: eventRows, error }, { data: presence }] = await Promise.all([
      events,
      supabase
        .from("user_presence")
        .select("profile_id, last_seen_at, path, profiles(full_name, email, role)")
        .gte("last_seen_at", onlineSince)
        .order("last_seen_at", { ascending: false })
        .limit(200),
    ])
    if (error) return NextResponse.json({ message: error.message, events: [], online: [] }, { status: 400 })

    return NextResponse.json({ events: eventRows || [], online: presence || [] })
  } catch (error) {
    console.error("Admin activity error:", error)
    return NextResponse.json({ message: "Activity is unavailable.", events: [], online: [] }, { status: 503 })
  }
}

// Clears every activity event (not who's online right now - that's live
// presence, not history). The clearing itself is then logged, so there's
// always a record of who emptied the log and when.
export async function DELETE() {
  try {
    const auth = await requireAdmin()
    if ("error" in auth) return auth.error

    const { error, count } = await createAdminClient()
      .from("activity_events")
      .delete({ count: "exact" })
      .not("id", "is", null)
    if (error) return NextResponse.json({ message: error.message }, { status: 400 })

    await logUserAction(auth.supabase, "Cleared the live activity log", `${count ?? 0} entries removed`)
    return NextResponse.json({ success: true, removed: count ?? 0 })
  } catch (error) {
    console.error("Clear activity error:", error)
    return NextResponse.json({ message: "Could not clear the activity log." }, { status: 500 })
  }
}
