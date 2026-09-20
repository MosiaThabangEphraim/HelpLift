import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

const CONVERSATION_TYPES = ["message_to_admin", "admin_message", "org_message"]

// The conversations the signed-in user has sent messages in: one entry per
// conversation (their latest sent message), with who it went to and whether the
// other side has replied since. Opening one shows the full conversation
// (GET /api/messages/thread).
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ message: "Authentication required." }, { status: 401 })

    // fanned_from is null: skip the copies made for an organization's teammates.
    const { data: sentRows, error } = await supabase
      .from("notifications")
      .select("id, thread_id, recipient_id, message, created_at")
      .eq("sender_id", user.id)
      .in("type", CONVERSATION_TYPES)
      .is("fanned_from", null)
      .order("created_at", { ascending: false })
      .limit(200)
    if (error) {
      const message = error.message.includes("thread_id") ? "Conversation history isn't available yet: the message-threads database update hasn't been applied." : error.message
      return NextResponse.json({ message, items: [] }, { status: 400 })
    }

    // One entry per conversation: the newest message the user sent in it.
    const latestByThread = new Map<string, NonNullable<typeof sentRows>[number]>()
    for (const row of sentRows || []) {
      const key = row.thread_id || row.id
      if (!latestByThread.has(key)) latestByThread.set(key, row)
    }
    const latest = [...latestByThread.entries()]

    // Has the other side written back since? (Newest message addressed to me in each conversation.)
    const threadIds = latest.map(([key]) => key)
    const receivedAt = new Map<string, string>()
    if (threadIds.length > 0) {
      const { data: received } = await supabase
        .from("notifications")
        .select("thread_id, created_at")
        .in("thread_id", threadIds)
        .eq("recipient_id", user.id)
        .order("created_at", { ascending: false })
      for (const row of received || []) {
        if (row.thread_id && !receivedAt.has(row.thread_id)) receivedAt.set(row.thread_id, row.created_at)
      }
    }

    // Recipient names. Notifications only store ids, and people can't read each
    // other's profiles, so resolve them with the service role. This only ever
    // names someone the user has already written to. A message to an
    // organization's account holder is shown as the organization's name.
    const recipientIds = [...new Set(latest.map(([, row]) => row.recipient_id))]
    const names = new Map<string, { name: string; role: string }>()
    if (recipientIds.length > 0) {
      const admin = createAdminClient()
      const [{ data: profiles }, { data: orgs }] = await Promise.all([
        admin.from("profiles").select("id, full_name, role").in("id", recipientIds),
        admin.from("organizations").select("profile_id, name").in("profile_id", recipientIds),
      ])
      const orgName = new Map((orgs || []).map(org => [org.profile_id, org.name]))
      for (const profile of profiles || []) {
        names.set(profile.id, {
          name: profile.role === "admin" ? "HelpLift Admin" : orgName.get(profile.id) || profile.full_name || "Unknown",
          role: profile.role,
        })
      }
    }

    const items = latest.map(([key, row]) => {
      const lastReceived = receivedAt.get(key)
      return {
        id: row.id,
        recipient_name: names.get(row.recipient_id)?.name || "Unknown recipient",
        recipient_role: names.get(row.recipient_id)?.role || null,
        message: row.message,
        created_at: row.created_at,
        replied: !!lastReceived && new Date(lastReceived).getTime() > new Date(row.created_at).getTime(),
      }
    })
    return NextResponse.json({ items })
  } catch (error) {
    console.error("Sent messages error:", error)
    return NextResponse.json({ message: "Could not load sent messages.", items: [] }, { status: 503 })
  }
}
