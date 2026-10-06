import { createAdminClient } from "@/lib/supabase/admin"

// Writes to activity_events and user_presence (see
// 20261006000200_activity_tracking.sql) for the admin Live activity tab.
//
// Page views come from the browser via app/api/activity; key actions are
// logged straight from the API routes that perform them, after they succeed.
// Only a short label is stored ("Posted a need") - never message text, form
// contents, passwords or payment details.
//
// Best-effort: it never throws, so a logging problem can't break the action.

export async function logActivity(entry: {
  profileId: string
  role?: string | null
  kind?: "page_view" | "action"
  action?: string
  path?: string | null
  detail?: string | null
}) {
  try {
    const admin = createAdminClient()
    const now = new Date().toISOString()
    const path = entry.path ? entry.path.slice(0, 300) : null
    const [{ error }] = await Promise.all([
      admin.from("activity_events").insert({
        profile_id: entry.profileId,
        role: entry.role || null,
        kind: entry.kind || "action",
        action: entry.action ? entry.action.slice(0, 120) : null,
        path,
        detail: entry.detail ? entry.detail.slice(0, 200) : null,
      }),
      // Presence keeps the page they're on; actions don't overwrite it with null.
      admin.from("user_presence").upsert(
        path ? { profile_id: entry.profileId, last_seen_at: now, path } : { profile_id: entry.profileId, last_seen_at: now },
        { onConflict: "profile_id" }
      ),
    ])
    if (error) console.warn("Activity log warning (has 20261006000200_activity_tracking.sql been applied?):", error.message)
  } catch (error) {
    console.warn("Activity log warning:", error)
  }
}

// Logs an action for whoever is signed in on `supabase` (the caller's own
// session client). Looks up their role so admins can filter by it.
export async function logUserAction(supabase: any, action: string, detail?: string | null) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
    await logActivity({ profileId: user.id, role: profile?.role, kind: "action", action, detail })
  } catch (error) {
    console.warn("Activity log warning:", error)
  }
}
