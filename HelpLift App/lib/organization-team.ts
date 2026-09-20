import type { SupabaseClient } from "@supabase/supabase-js"

// organization_documents.uploaded_by is `not null ... on delete cascade`, so
// deleting a team member's account would silently delete every document they
// uploaded for the organization — and the files sit under a folder named after
// the uploader's user id, which teammates can only read while that user is
// still on the team. Before a member's account is deleted, hand their
// documents (rows and storage files) to another owner.
//
// Returns an error message if any file could not be moved, in which case the
// caller must NOT go ahead with the deletion.
export async function transferMemberDocuments(
  admin: SupabaseClient,
  organizationId: string,
  fromProfileId: string,
  toProfileId: string
): Promise<string | null> {
  const { data: docs, error } = await admin
    .from("organization_documents")
    .select("id, storage_path")
    .eq("organization_id", organizationId)
    .eq("uploaded_by", fromProfileId)
  if (error) return error.message

  for (const doc of docs || []) {
    const fileName = doc.storage_path.split("/").slice(1).join("/")
    const newPath = `${toProfileId}/${fileName}`
    const { error: moveError } = await admin.storage.from("organization-documents").move(doc.storage_path, newPath)
    if (moveError) return `Could not preserve a document (${moveError.message}).`
    const { error: updateError } = await admin
      .from("organization_documents")
      .update({ uploaded_by: toProfileId, storage_path: newPath })
      .eq("id", doc.id)
    if (updateError) return updateError.message
  }
  return null
}
