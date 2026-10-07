import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getOrgContext, roleAtLeast, insufficientRoleMessage } from "@/lib/organization-access"

// Deletes a previously uploaded verification document - owner-only, same
// role required to upload one (see POST .../documents). Any owner may
// delete a document a teammate uploaded, not just their own.
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ message: "Authentication required." }, { status: 401 })

    const orgCtx = await getOrgContext<{ id: any }>(supabase, user.id, "id")
    if (!orgCtx) return NextResponse.json({ message: "Organization profile not found." }, { status: 404 })
    if (!roleAtLeast(orgCtx.role, "owner")) return NextResponse.json({ message: insufficientRoleMessage(orgCtx.role, "owner") }, { status: 403 })

    const { id } = await context.params
    const { data: document, error: lookupError } = await supabase
      .from("organization_documents")
      .select("id, storage_path, organization_id")
      .eq("id", id)
      .eq("organization_id", orgCtx.organization.id)
      .single()
    if (lookupError || !document) return NextResponse.json({ message: "Document not found." }, { status: 404 })

    // .select() after .delete() so a delete RLS silently blocks (0 rows
    // affected, no error) doesn't get reported back as a success - that's
    // otherwise indistinguishable from an actual delete from this response.
    const { data: deletedRows, error: deleteError } = await supabase
      .from("organization_documents")
      .delete()
      .eq("id", id)
      .select("id")
    if (deleteError) return NextResponse.json({ message: deleteError.message }, { status: 400 })
    if (!deletedRows || deletedRows.length === 0) {
      return NextResponse.json({ message: "Could not delete this document - you may not have permission." }, { status: 403 })
    }

    // Best-effort: the row is already gone even if this fails, so don't turn
    // a leftover storage file into an error the org has to deal with.
    const { error: storageError } = await supabase.storage.from("organization-documents").remove([document.storage_path])
    if (storageError) console.warn("Organization document storage cleanup warning:", storageError.message)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Document delete error:", error)
    return NextResponse.json({ message: "Unable to delete this document right now." }, { status: 503 })
  }
}
