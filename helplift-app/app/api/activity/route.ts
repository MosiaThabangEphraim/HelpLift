import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { logActivity } from "@/lib/activity-log"
import { isRateLimited } from "@/lib/rate-limit"
import { createAdminClient } from "@/lib/supabase/admin"
import { labelForApiAction } from "@/lib/activity-labels"

// Browser-side activity for the admin Live activity tab
// (components/activity-tracker.tsx): page views, a once-a-minute "still here"
// heartbeat for "online now", sign-outs (which happen in the browser),
// small in-page actions ("ui_action": settings switched, tab opened...) and
// successful API changes ("api_action": labelled here from the route, see
// lib/activity-labels.ts).
// Only for signed-in users - the user comes from their own session, never
// from the request body, so nobody can log activity for someone else.

const RATE_LIMIT = 120
const RATE_WINDOW_MS = 60_000

// Strips query strings and hides one-time tokens in invite links, so no
// secret ever lands in the log.
function cleanPath(path: unknown) {
  if (typeof path !== "string" || !path.startsWith("/")) return null
  return path
    .split(/[?#]/)[0]
    .replace(/^\/(invite|admin-invite)\/[^/]+/, "/$1/[token]")
    .slice(0, 300)
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ success: false }, { status: 401 })

    if (isRateLimited(`activity:${user.id}`, RATE_LIMIT, RATE_WINDOW_MS)) {
      return NextResponse.json({ success: false }, { status: 429 })
    }

    const body = await request.json().catch(() => ({}))
    const path = cleanPath(body.path)
    const event = body.event

    if (event === "heartbeat") {
      // Presence only - no history row for every minute someone keeps a tab open.
      await createAdminClient().from("user_presence").upsert(
        path ? { profile_id: user.id, last_seen_at: new Date().toISOString(), path } : { profile_id: user.id, last_seen_at: new Date().toISOString() },
        { onConflict: "profile_id" }
      )
      return NextResponse.json({ success: true })
    }

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
    if (event === "signed_out") {
      await logActivity({ profileId: user.id, role: profile?.role, kind: "action", action: "Signed out", path })
      return NextResponse.json({ success: true })
    }
    if (event === "ui_action" && typeof body.action === "string" && body.action.trim()) {
      const detail = typeof body.detail === "string" ? body.detail.trim().slice(0, 120) : null
      await logActivity({ profileId: user.id, role: profile?.role, kind: "action", action: body.action.trim().slice(0, 80), path, detail })
      return NextResponse.json({ success: true })
    }
    if (event === "api_action") {
      const action = labelForApiAction(body.method, body.api)
      if (action) await logActivity({ profileId: user.id, role: profile?.role, kind: "action", action, path })
      return NextResponse.json({ success: true })
    }
    if (event === "page_view" && path) {
      await logActivity({ profileId: user.id, role: profile?.role, kind: "page_view", path })
      return NextResponse.json({ success: true })
    }
    return NextResponse.json({ success: false }, { status: 400 })
  } catch (error) {
    console.warn("Activity route warning:", error)
    return NextResponse.json({ success: false }, { status: 500 })
  }
}
