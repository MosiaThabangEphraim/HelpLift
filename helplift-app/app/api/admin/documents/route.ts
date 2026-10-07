import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ message: "Authentication required." }, { status: 401 })
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
    if (profile?.role !== "admin") return NextResponse.json({ message: "Administrator access required." }, { status: 403 })

    const { data: documents, error } = await supabase.from("organization_documents").select("id, organization_id, file_name, document_type, storage_path, created_at").order("created_at", { ascending: false })
    if (error) return NextResponse.json({ message: error.message }, { status: 400 })
    const withLinks = await Promise.all((documents || []).map(async document => {
      const { data } = await supabase.storage.from("organization-documents").createSignedUrl(document.storage_path, 300)
      return { ...document, signed_url: data?.signedUrl || null }
    }))
    return NextResponse.json({ documents: withLinks })
  } catch (error) {
    console.error("Admin document review error:", error)
    return NextResponse.json({ message: "Document review is unavailable." }, { status: 503 })
  }
}
