import type { SupabaseClient } from "@supabase/supabase-js"

export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024
export const MAX_DOCUMENTS = 10
const ALLOWED_DOCUMENT_EXTENSIONS = /\.(pdf|png|jpe?g)$/i

// Stores an organization's verification documents (storage file + database row)
// with the service role. Used when the requester may not be signed in with a
// usable session yet. Files that can't be stored are returned by name so the
// caller can tell the user instead of pretending everything worked.
export async function storeOrganizationDocuments(
  admin: SupabaseClient,
  options: { userId: string; organizationId: string; files: File[]; types: string[] }
): Promise<{ uploaded: number; failed: string[] }> {
  const { userId, organizationId, files, types } = options
  const failed: string[] = []
  let uploaded = 0

  const toStore = files.slice(0, MAX_DOCUMENTS)
  files.slice(MAX_DOCUMENTS).forEach(file => failed.push(file.name))

  for (let i = 0; i < toStore.length; i++) {
    const file = toStore[i]
    if (file.size > MAX_DOCUMENT_BYTES || !ALLOWED_DOCUMENT_EXTENSIONS.test(file.name)) {
      failed.push(file.name)
      continue
    }
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
      const storagePath = `${userId}/${crypto.randomUUID()}-${safeName}`
      const { error: uploadError } = await admin.storage
        .from("organization-documents")
        .upload(storagePath, file, { contentType: file.type || "application/octet-stream", upsert: false })
      if (uploadError) throw new Error(uploadError.message)

      const { error: insertError } = await admin.from("organization_documents").insert({
        organization_id: organizationId,
        uploaded_by: userId,
        file_name: file.name,
        storage_path: storagePath,
        document_type: types[i] || "supporting_document",
      })
      if (insertError) {
        await admin.storage.from("organization-documents").remove([storagePath])
        throw new Error(insertError.message)
      }
      uploaded++
    } catch (error) {
      console.warn("Organization document upload failed:", file.name, error)
      failed.push(file.name)
    }
  }
  return { uploaded, failed }
}
