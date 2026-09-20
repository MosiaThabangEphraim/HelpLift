import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getOrgContext, roleAtLeast, insufficientRoleMessage } from "@/lib/organization-access"

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ message: "Authentication required." }, { status: 401 })
  const orgCtx = await getOrgContext<{ id: any }>(supabase, user.id, "id")
    const organization = orgCtx?.organization ?? null
  if (!organization) return NextResponse.json({ message: "Organization profile not found." }, { status: 404 })
  const { data, error } = await supabase.from("organization_documents").select("id, file_name, document_type, created_at").eq("organization_id", organization.id).order("created_at", { ascending: false })
  if (error) return NextResponse.json({ message: error.message }, { status: 400 })
  return NextResponse.json({ documents: data || [] })
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ message: "Authentication required." }, { status: 401 })
    const orgCtx = await getOrgContext<{ id: any }>(supabase, user.id, "id")
    const organization = orgCtx?.organization ?? null
    if (orgCtx && !roleAtLeast(orgCtx.role, "owner")) return NextResponse.json({ message: insufficientRoleMessage(orgCtx.role, "owner") }, { status: 403 })
    if (!organization) return NextResponse.json({ message: "Organization profile not found." }, { status: 404 })

    const formData = await request.formData()
    const file = formData.get("file")
    const documentType = String(formData.get("document_type") || "supporting_document")
    if (!(file instanceof File) || file.size === 0) return NextResponse.json({ message: "Choose a document to upload." }, { status: 400 })
    if (file.size > 10 * 1024 * 1024) return NextResponse.json({ message: "Documents must be smaller than 10 MB." }, { status: 400 })

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
    const storagePath = `${user.id}/${crypto.randomUUID()}-${safeName}`
    const { error: uploadError } = await supabase.storage.from("organization-documents").upload(storagePath, file, { contentType: file.type || "application/octet-stream", upsert: false })
    if (uploadError) return NextResponse.json({ message: uploadError.message }, { status: 400 })

    const { data: document, error: insertError } = await supabase.from("organization_documents").insert({ organization_id: organization.id, uploaded_by: user.id, file_name: file.name, storage_path: storagePath, document_type: documentType }).select("id, file_name, document_type, created_at").single()
    if (insertError) {
      await supabase.storage.from("organization-documents").remove([storagePath])
      return NextResponse.json({ message: insertError.message }, { status: 400 })
    }
    return NextResponse.json({ document }, { status: 201 })
  } catch (error) {
    console.error("Document upload error:", error)
    return NextResponse.json({ message: "Document upload is unavailable." }, { status: 503 })
  }
}
