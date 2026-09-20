import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getOrgContext, roleAtLeast, insufficientRoleMessage } from "@/lib/organization-access"

export async function DELETE(request: Request, context: { params: Promise<{ id: string; mediaId: string }> }) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ message: "Authentication required." }, { status: 401 })

    const orgCtx = await getOrgContext<{ id: any }>(supabase, user.id, "id")
    const org = orgCtx?.organization ?? null
    if (orgCtx && !roleAtLeast(orgCtx.role, "manager")) return NextResponse.json({ message: insufficientRoleMessage(orgCtx.role, "manager") }, { status: 403 })
    if (!org) return NextResponse.json({ message: "Organization access required." }, { status: 403 })

    const { id, mediaId } = await context.params
    const { data: story } = await supabase.from("impact_stories").select("id").eq("id", id).eq("organization_id", org.id).single()
    if (!story) return NextResponse.json({ message: "Story not found." }, { status: 404 })

    const { error } = await supabase.from("impact_story_media").delete().eq("id", mediaId).eq("story_id", id)
    if (error) return NextResponse.json({ message: error.message }, { status: 400 })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Delete story media error:", error)
    return NextResponse.json({ message: "Media deletion is unavailable." }, { status: 503 })
  }
}
