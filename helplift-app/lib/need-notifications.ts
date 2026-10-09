import { createAdminClient } from "@/lib/supabase/admin"

// Who hears about a need's status changing (best-effort - never throws):
// - Administrators, when an organization closes a need, marks it fulfilled or
//   asks to reopen it ("need_update" notifications, opened from the admin bell
//   into the Needs tab).
// - Givers who offered to help (pending or accepted offers) or donated to the
//   need, when it is closed, fulfilled or deleted - so nobody keeps waiting
//   on a need that has ended. The nightly expiry job does the same in SQL
//   (20261008000400_need_end_notifications.sql, which replaces the job from
//   20261008000300).
// Runs with the service role, since the sender can't normally write
// notifications for other people.

export type NeedEnding = "closed" | "closed_by_admin" | "fulfilled" | "deleted"

type Db = ReturnType<typeof createAdminClient>

/** Profile ids of givers with an open offer on, or a successful donation to, a need. */
export async function needSupporterIds(db: Db, needId: string) {
  const [{ data: interests }, { data: donations }] = await Promise.all([
    db.from("support_interests").select("givers(profile_id)").eq("need_id", needId).in("status", ["pending", "accepted"]),
    db.from("donations").select("givers(profile_id)").eq("need_id", needId).eq("status", "successful"),
  ])
  const ids = new Set<string>()
  for (const row of [...(interests || []), ...(donations || [])] as any[]) {
    const giver = Array.isArray(row.givers) ? row.givers[0] : row.givers
    if (giver?.profile_id) ids.add(giver.profile_id)
  }
  return [...ids]
}

/** Tells the givers behind a need that it has ended. Pass supporterIds when the need is about to be deleted. */
export async function notifyNeedSupporters(
  need: { id: string; title: string },
  organizationName: string,
  ending: NeedEnding,
  supporterIds?: string[],
) {
  try {
    const db = createAdminClient()
    const recipients = supporterIds ?? (await needSupporterIds(db, need.id))
    if (recipients.length === 0) return
    const text = {
      fulfilled: {
        title: "A need you supported was fulfilled",
        message: `${organizationName} marked "${need.title}" as fulfilled. Thank you for helping make it happen!`,
      },
      closed: {
        title: "A need you supported was closed",
        message: `${organizationName} closed "${need.title}", so it no longer accepts offers or donations. Any donation you already made stays with the organization.`,
      },
      closed_by_admin: {
        title: "A need you supported was closed",
        message: `"${need.title}" from ${organizationName} was closed by the HelpLift team, so it no longer accepts offers or donations. Any donation you already made stays with the organization.`,
      },
      deleted: {
        title: "A need you supported was removed",
        message: `"${need.title}" from ${organizationName} was removed by the HelpLift team. Any open offer on it has been withdrawn, and any donation you already made stays with the organization.`,
      },
    }[ending]
    await db.from("notifications").insert(recipients.map(recipient_id => ({
      recipient_id,
      sender_name: "HelpLift Notifications",
      type: "need_status_update",
      ...text,
    })))
  } catch (error) {
    console.warn("Need supporter notification warning:", error)
  }
}

/** Tells every active administrator what an organization did with one of its needs. */
export async function notifyAdminsOfNeedChange(
  need: { id: string; title: string },
  organizationName: string,
  status: "closed" | "fulfilled" | "reopen_pending",
  reason?: string | null,
) {
  try {
    const db = createAdminClient()
    const { data: admins } = await db.from("profiles").select("id").eq("role", "admin").eq("suspended", false)
    if (!admins?.length) return
    const text = {
      closed: { title: "Need closed by organization", message: `${organizationName} closed the need "${need.title}".` },
      fulfilled: { title: "Need marked fulfilled", message: `${organizationName} marked the need "${need.title}" as fulfilled.` },
      reopen_pending: {
        title: "Need reopen requested",
        message: `${organizationName} asked to reopen the need "${need.title}".${reason ? ` Reason: ${reason}` : ""} Review it in the Needs tab.`,
      },
    }[status]
    await db.from("notifications").insert(admins.map(row => ({
      recipient_id: row.id,
      sender_name: organizationName,
      type: "need_update",
      ...text,
    })))
  } catch (error) {
    console.warn("Admin need notification warning:", error)
  }
}

/** Organization name for notification text. */
export async function organizationName(db: Db, organizationId: string) {
  const { data } = await db.from("organizations").select("name").eq("id", organizationId).maybeSingle()
  return data?.name || "An organization"
}
