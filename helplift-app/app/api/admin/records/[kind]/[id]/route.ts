import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireAdmin } from "@/lib/require-admin"
import { isDeletableKind, loadDeletable, performDelete, previewDelete, DELETABLE } from "@/lib/admin-delete"
import { logActivity } from "@/lib/activity-log"
import { needSupporterIds, notifyNeedSupporters, organizationName } from "@/lib/need-notifications"

// Administrators can permanently delete any record of the kinds in
// lib/admin-delete.ts (needs, gifts, claims, stories, fulfillments, messages,
// feedback, developer reports, organization documents). Financial records -
// donations and withdrawals - are never deletable.
//   GET    -> a preview: what the record is, what else goes with it, any warning
//   DELETE -> the deletion itself, recorded in the activity log for accountability
// The caller must be an admin; the delete itself runs with the service role
// so it isn't limited by each table's own row-level policies.

type Context = { params: Promise<{ kind: string; id: string }> }

async function resolve(context: Context) {
  const auth = await requireAdmin()
  if ("error" in auth) return { error: auth.error }
  const { kind, id } = await context.params
  if (!isDeletableKind(kind)) return { error: NextResponse.json({ message: "That kind of record can't be deleted." }, { status: 400 }) }
  const db = createAdminClient()
  const row = await loadDeletable(db, kind, id)
  if (!row) return { error: NextResponse.json({ message: "That record no longer exists." }, { status: 404 }) }
  return { auth, kind, db, row }
}

export async function GET(_request: Request, context: Context) {
  try {
    const resolved = await resolve(context)
    if ("error" in resolved) return resolved.error
    return NextResponse.json({ preview: await previewDelete(resolved.db, resolved.kind, resolved.row) })
  } catch (error) {
    console.error("Admin delete preview error:", error)
    return NextResponse.json({ message: "Couldn't check this record right now." }, { status: 503 })
  }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    const resolved = await resolve(context)
    if ("error" in resolved) return resolved.error
    const { auth, kind, db, row } = resolved

    const preview = await previewDelete(db, kind, row)
    if (preview.blocked) return NextResponse.json({ message: preview.blocked }, { status: 409 })

    // A deleted need: gather who to tell before its offers are deleted with it.
    let deletedNeed: { id: string; title: string; organization_id: string; supporters: string[] } | null = null
    if (kind === "need") {
      const { data: need } = await db.from("needs").select("id, title, organization_id").eq("id", row.id).maybeSingle()
      if (need) deletedNeed = { ...need, supporters: await needSupporterIds(db, need.id) }
    }

    await performDelete(db, kind, row)

    if (deletedNeed) {
      try {
        const { data: org } = await db.from("organizations").select("profile_id").eq("id", deletedNeed.organization_id).maybeSingle()
        if (org?.profile_id) {
          await db.from("notifications").insert({
            recipient_id: org.profile_id,
            sender_id: auth.user.id,
            sender_name: "HelpLift Notifications",
            type: "need_status_update",
            title: "Need removed",
            message: `Your need "${deletedNeed.title}" was removed by a HelpLift administrator. If you have questions, message the HelpLift team from your dashboard.`,
          })
        }
        await notifyNeedSupporters(deletedNeed, await organizationName(db, deletedNeed.organization_id), "deleted", deletedNeed.supporters)
      } catch (notifyError) {
        console.warn("Deleted need notification warning:", notifyError)
      }
    }

    // Accountability: deletions are always recorded, and the activity log
    // itself can't be deleted.
    const linked = preview.linked.map(item => `${item.count} ${item.label}`).join(", ")
    await logActivity({
      profileId: auth.user.id,
      role: "admin",
      action: `Deleted a ${DELETABLE[kind].label}`,
      detail: `${preview.title}${linked ? ` - with ${linked}` : ""}`,
    })

    return NextResponse.json({ success: true, message: `Deleted ${preview.title}.` })
  } catch (error: any) {
    console.error("Admin delete error:", error)
    return NextResponse.json({ message: error?.message ? `Couldn't delete it: ${error.message}` : "Couldn't delete it right now." }, { status: 400 })
  }
}
