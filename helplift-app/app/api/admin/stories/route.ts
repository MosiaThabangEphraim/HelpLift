import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// Admin review queue for impact stories: every story (pending first), with its
// organization and media, so it can be approved or rejected before it's public.
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ message: "Authentication required." }, { status: 401 })
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
    if (profile?.role !== "admin") return NextResponse.json({ message: "Administrator access required." }, { status: 403 })

    const { data, error } = await supabase
      .from("impact_stories")
      .select("id, title, content, author_role, image_url, video_url, status, rejection_reason, created_at, organizations(id, name)")
      .order("created_at", { ascending: false })
    if (error) return NextResponse.json({ message: error.message, stories: [] }, { status: 400 })

    const ids = (data || []).map(s => s.id)
    const mediaByStory: Record<string, { id: string; media_type: string; url: string }[]> = {}
    if (ids.length > 0) {
      const { data: mediaRows } = await supabase
        .from("impact_story_media")
        .select("id, story_id, media_type, url, position")
        .in("story_id", ids)
        .order("position", { ascending: true })
      for (const row of mediaRows || []) {
        if (!mediaByStory[row.story_id]) mediaByStory[row.story_id] = []
        mediaByStory[row.story_id].push({ id: row.id, media_type: row.media_type, url: row.url })
      }
    }

    const order: Record<string, number> = { pending: 0, rejected: 1, approved: 2 }
    const stories = (data || [])
      .map(s => ({ ...s, media: mediaByStory[s.id] || [] }))
      .sort((a, b) => (order[a.status] ?? 3) - (order[b.status] ?? 3))
    return NextResponse.json({ stories })
  } catch (error) {
    console.error("Admin stories fetch error:", error)
    return NextResponse.json({ message: "Stories are unavailable.", stories: [] }, { status: 503 })
  }
}
