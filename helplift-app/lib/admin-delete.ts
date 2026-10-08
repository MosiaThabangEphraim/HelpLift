import type { SupabaseClient } from "@supabase/supabase-js"

// What administrators can permanently delete, and everything that goes with
// each record (app/api/admin/records/[kind]/[id]). Used both to PREVIEW a
// deletion - so the admin sees exactly what else will be removed before
// confirming - and to carry it out, including the stored files.
//
// Deliberately NOT deletable:
// - Financial records: donations and withdrawals (and anything whose deletion
//   would take them with it - e.g. a need that has donations). They're kept
//   for accounting and audit, as the Privacy Policy states.
// - The Security log (login_attempts), Live activity history
//   (activity_events / user_presence), site-visit statistics and platform
//   settings - the audit trail. Every deletion here is itself recorded in the
//   activity log.
// Accounts keep their own flow (app/api/admin/users/[id]), which refuses
// accounts that hold financial records.

export type DeletableKind =
  | "need"
  | "gift"
  | "claim"
  | "story"
  | "fulfillment"
  | "message"
  | "feedback"
  | "dev-report"
  | "tip-off"
  | "organization-document"

type Files = { bucket: string; paths: string[] }
type Linked = { label: string; count: number }
export type DeletePreview = { title: string; linked: Linked[]; warning: string | null; blocked: string | null }

type KindConfig = {
  table: string
  label: string
  /** A short description of the record for the confirmation and the audit log. */
  describe: (row: any) => string
  select: string
  /** Records that will be deleted (or unlinked) along with it. */
  linked?: (db: SupabaseClient, row: any) => Promise<Linked[]>
  /** Files to remove from storage, collected before the rows disappear. */
  files?: (db: SupabaseClient, row: any) => Promise<Files[]>
  /** A warning for deletions with consequences. */
  warning?: (row: any) => string | null
  /** A reason the record can't be deleted at all, if any. */
  blocked?: (db: SupabaseClient, row: any) => Promise<string | null>
}

const rand = (value: unknown) => `R${Number(value || 0).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const first = (value: any) => (Array.isArray(value) ? value[0] : value)

async function count(db: SupabaseClient, table: string, column: string, values: string | string[]) {
  const list = Array.isArray(values) ? values : [values]
  if (list.length === 0) return 0
  const { count: total } = await db.from(table).select("id", { count: "exact", head: true }).in(column, list)
  return total || 0
}

async function ids(db: SupabaseClient, table: string, column: string, values: string | string[]) {
  const list = Array.isArray(values) ? values : [values]
  if (list.length === 0) return []
  const { data } = await db.from(table).select("id").in(column, list)
  return (data || []).map((row: any) => row.id as string)
}

async function paths(db: SupabaseClient, table: string, column: string, values: string | string[], pathColumn = "storage_path") {
  const list = Array.isArray(values) ? values : [values]
  if (list.length === 0) return []
  const { data } = await db.from(table).select(pathColumn).in(column, list)
  return (data || []).map((row: any) => row[pathColumn]).filter(Boolean) as string[]
}

export const DELETABLE: Record<DeletableKind, KindConfig> = {
  need: {
    table: "needs",
    label: "need",
    select: "id, title, status",
    describe: row => `"${row.title}" (${String(row.status).replace("_", " ")})`,
    linked: async (db, row) => {
      const interestIds = await ids(db, "support_interests", "need_id", row.id)
      return [
        { label: "offers to help", count: interestIds.length },
        { label: "fulfillments", count: await count(db, "fulfillments", "interest_id", interestIds) },
        { label: "attachments", count: await count(db, "need_attachments", "need_id", row.id) },
      ]
    },
    files: async (db, row) => {
      const interestIds = await ids(db, "support_interests", "need_id", row.id)
      const fulfillmentIds = await ids(db, "fulfillments", "interest_id", interestIds)
      return [
        { bucket: "need-attachments", paths: await paths(db, "need_attachments", "need_id", row.id) },
        { bucket: "support-interest-photos", paths: await paths(db, "support_interest_photos", "interest_id", interestIds) },
        { bucket: "fulfillment-proofs", paths: await paths(db, "fulfillment_proofs", "fulfillment_id", fulfillmentIds) },
      ]
    },
    // The database would delete a need's donations along with it.
    blocked: async (db, row) => {
      const donations = await count(db, "donations", "need_id", row.id)
      return donations > 0
        ? `This need has ${donations} donation${donations === 1 ? "" : "s"} linked to it. Donations are financial records and can't be deleted, so the need has to stay. You can close or reject it instead.`
        : null
    },
  },
  gift: {
    table: "gift_offerings",
    label: "Gift Library offering",
    select: "id, title, status",
    describe: row => `"${row.title}" (${row.status})`,
    linked: async (db, row) => [
      { label: "claims", count: await count(db, "gift_claims", "gift_offering_id", row.id) },
      { label: "fulfillments", count: await count(db, "fulfillments", "gift_offering_id", row.id) },
      { label: "photos", count: await count(db, "gift_offering_photos", "gift_offering_id", row.id) },
      { label: "donations unlinked from it (the donations stay)", count: await count(db, "donations", "gift_offering_id", row.id) },
    ],
    files: async (db, row) => {
      const claimIds = await ids(db, "gift_claims", "gift_offering_id", row.id)
      const fulfillmentIds = await ids(db, "fulfillments", "gift_offering_id", row.id)
      return [
        { bucket: "gift-offering-photos", paths: await paths(db, "gift_offering_photos", "gift_offering_id", row.id) },
        { bucket: "gift-claim-documents", paths: await paths(db, "gift_claim_documents", "claim_id", claimIds) },
        { bucket: "fulfillment-proofs", paths: await paths(db, "fulfillment_proofs", "fulfillment_id", fulfillmentIds) },
      ]
    },
  },
  claim: {
    table: "gift_claims",
    label: "gift claim",
    select: "id, status, gift_offerings(title), organizations(name)",
    describe: row => `${first(row.organizations)?.name || "An organization"}'s claim on "${first(row.gift_offerings)?.title || "an offering"}" (${row.status})`,
    linked: async (db, row) => [{ label: "documents", count: await count(db, "gift_claim_documents", "claim_id", row.id) }],
    files: async (db, row) => [{ bucket: "gift-claim-documents", paths: await paths(db, "gift_claim_documents", "claim_id", row.id) }],
  },
  story: {
    table: "impact_stories",
    label: "impact story",
    select: "id, title, status",
    describe: row => `"${row.title}" (${row.status})`,
    linked: async (db, row) => [{ label: "photos and videos", count: await count(db, "impact_story_media", "story_id", row.id) }],
    files: async (db, row) => [{ bucket: "impact-media", paths: await paths(db, "impact_story_media", "story_id", row.id) }],
  },
  fulfillment: {
    table: "fulfillments",
    label: "fulfillment",
    select: "id, status",
    describe: row => `fulfillment (${String(row.status).replace("_", " ")})`,
    linked: async (db, row) => [{ label: "delivery proof files", count: await count(db, "fulfillment_proofs", "fulfillment_id", row.id) }],
    files: async (db, row) => [{ bucket: "fulfillment-proofs", paths: await paths(db, "fulfillment_proofs", "fulfillment_id", row.id) }],
  },
  message: {
    table: "notifications",
    label: "message",
    select: "id, title, attachment_storage_path",
    describe: row => `"${row.title}"`,
    linked: async (db, row) => [{ label: "attachments", count: await count(db, "notification_attachments", "notification_id", row.id) }],
    files: async (db, row) => [
      { bucket: "message-attachments", paths: [...(await paths(db, "notification_attachments", "notification_id", row.id)), ...(row.attachment_storage_path ? [row.attachment_storage_path] : [])] },
    ],
  },
  feedback: {
    table: "platform_feedback",
    label: "feedback",
    select: "id, rating, sender_name",
    describe: row => `${row.rating}/5 feedback from ${row.sender_name || "a user"}`,
  },
  "dev-report": {
    table: "developer_reports",
    label: "developer report",
    select: "id, title, attachments",
    describe: row => `"${row.title}"`,
    linked: async (_db, row) => [{ label: "proof files", count: Array.isArray(row.attachments) ? row.attachments.length : 0 }],
    files: async (_db, row) => [{ bucket: "developer-reports", paths: (Array.isArray(row.attachments) ? row.attachments : []).map((file: any) => file.path).filter(Boolean) }],
  },
  "tip-off": {
    table: "tip_offs",
    label: "tip-off",
    select: "id, organization_name, attachments",
    describe: row => `the tip-off about "${row.organization_name}"`,
    linked: async (_db, row) => [{ label: "evidence files", count: Array.isArray(row.attachments) ? row.attachments.length : 0 }],
    files: async (_db, row) => [{ bucket: "tip-off-evidence", paths: (Array.isArray(row.attachments) ? row.attachments : []).map((file: any) => file.path).filter(Boolean) }],
  },
  "organization-document": {
    table: "organization_documents",
    label: "organization document",
    select: "id, file_name, storage_path",
    describe: row => `"${row.file_name || "document"}"`,
    files: async (_db, row) => [{ bucket: "organization-documents", paths: row.storage_path ? [row.storage_path] : [] }],
  },
}

export function isDeletableKind(kind: string): kind is DeletableKind {
  return Object.prototype.hasOwnProperty.call(DELETABLE, kind)
}

export async function loadDeletable(db: SupabaseClient, kind: DeletableKind, id: string) {
  const config = DELETABLE[kind]
  const { data } = await db.from(config.table).select(config.select).eq("id", id).maybeSingle()
  return data as any
}

export async function previewDelete(db: SupabaseClient, kind: DeletableKind, row: any): Promise<DeletePreview> {
  const config = DELETABLE[kind]
  const linked = config.linked ? (await config.linked(db, row)).filter(item => item.count > 0) : []
  return {
    title: `${config.label} ${config.describe(row)}`,
    linked,
    warning: config.warning ? config.warning(row) : null,
    blocked: config.blocked ? await config.blocked(db, row) : null,
  }
}

/** Deletes the record (children go with it via the database's cascades) and then its stored files. */
export async function performDelete(db: SupabaseClient, kind: DeletableKind, row: any) {
  const config = DELETABLE[kind]
  const files = config.files ? await config.files(db, row) : []
  const { error } = await db.from(config.table).delete().eq("id", row.id)
  if (error) throw new Error(error.message)
  for (const { bucket, paths: list } of files) {
    const unique = Array.from(new Set(list))
    if (unique.length === 0) continue
    const { error: storageError } = await db.storage.from(bucket).remove(unique)
    if (storageError) console.warn(`Admin delete: couldn't remove files from ${bucket}:`, storageError.message)
  }
}
