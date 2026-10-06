import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireAdmin } from "@/lib/require-admin"
import { isDeletableKind, loadDeletable, performDelete, previewDelete, DELETABLE } from "@/lib/admin-delete"
import { logActivity } from "@/lib/activity-log"

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
    await performDelete(db, kind, row)

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
