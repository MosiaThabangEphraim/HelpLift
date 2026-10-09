import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { roleAtLeast, type OrgRole } from "@/lib/organization-access"
import { TIMELINE_BUCKET, TIMELINE_COLUMNS, withAttachmentUrls, type TimelineViewer } from "@/lib/org-timeline"

// An organization's timeline, pinned posts first and then newest first, plus
// what the person looking at it may do (post, edit/delete, moderate). Row
// Level Security decides visibility: anyone sees a verified organization's
// timeline; its own team and administrators always do.
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const limit = Math.min(Math.max(Number(new URL(request.url).searchParams.get("limit")) || 30, 1), 100)
    const supabase = await createClient()

    const viewer: TimelineViewer = { userId: null, canPost: false, canManageAll: false, isAdmin: false }
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      viewer.userId = user.id
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
      if (profile?.role === "admin") viewer.isAdmin = true
      if (profile?.role === "organization") {
        const { data: membership } = await supabase
          .from("organization_members")
          .select("role")
          .eq("profile_id", user.id)
          .eq("organization_id", id)
          .maybeSingle()
        const role = membership?.role as OrgRole | undefined
        viewer.canPost = roleAtLeast(role, "coordinator")
        viewer.canManageAll = roleAtLeast(role, "manager")
      }
    }

    const { data, error } = await supabase
      .from("org_timeline_posts")
      .select(TIMELINE_COLUMNS)
      .eq("organization_id", id)
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(limit)
    if (error) return NextResponse.json({ posts: [], viewer, message: error.message }, { status: 200 })

    const storage = supabase.storage.from(TIMELINE_BUCKET)
    const posts = (data || []).map(post => withAttachmentUrls(post, path => storage.getPublicUrl(path).data.publicUrl))
    return NextResponse.json({ posts, viewer })
  } catch (error) {
    console.error("Organization timeline error:", error)
    return NextResponse.json({ posts: [], message: "The timeline is unavailable right now." }, { status: 503 })
  }
}
