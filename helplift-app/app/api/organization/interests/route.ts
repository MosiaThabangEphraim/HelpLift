import { NextResponse } from "next/server"
import { fileUrl } from "@/lib/file-links"
import { createClient } from "@/lib/supabase/server"
import { getOrgContext, roleAtLeast, insufficientRoleMessage } from "@/lib/organization-access"

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ message: "Authentication required." }, { status: 401 })
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
  if (profile?.role !== "organization") return NextResponse.json({ message: "Organization access required." }, { status: 403 })
  const orgCtx = await getOrgContext<{ id: any }>(supabase, user.id, "id")
    const organization = orgCtx?.organization ?? null
  if (!organization) return NextResponse.json({ message: "Organization profile not found." }, { status: 404 })
  const { data, error } = await supabase
    .from("support_interests")
    .select("id, status, message, created_at, needs!inner(title, organization_id), givers(profile_id, name, email, phone, account_type, avatar_url), support_interest_photos(id, storage_path, file_name)")
    .eq("needs.organization_id", organization.id)
    .order("created_at", { ascending: false })
  if (error) return NextResponse.json({ message: error.message }, { status: 400 })

  const withPhotoUrls = await Promise.all((data || []).map(async (item: any) => {
    const photos = await Promise.all((item.support_interest_photos || []).map(async (p: any) => {
      const signed = { signedUrl: fileUrl("support-interest-photos", p.storage_path) }
      return { id: p.id, file_name: p.file_name, url: signed?.signedUrl || null }
    }))
    const { support_interest_photos, ...rest } = item
    return { ...rest, photos }
  }))

  return NextResponse.json({ interests: withPhotoUrls })
}
