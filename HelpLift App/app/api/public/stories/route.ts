import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from("impact_stories")
      .select("id, title, content, author_role, image_url, video_url, created_at, organizations(id, name, type, city, province)")
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .limit(10)

    if (error) {
      return NextResponse.json({ success: true, stories: [] })
    }

    const storyIds = (data || []).map((s) => s.id)
    const mediaByStory: Record<string, { id: string; media_type: string; url: string }[]> = {}
    if (storyIds.length > 0) {
      const { data: mediaRows } = await supabase
        .from("impact_story_media")
        .select("id, story_id, media_type, url, position")
        .in("story_id", storyIds)
        .order("position", { ascending: true })
      for (const row of mediaRows || []) {
        if (!mediaByStory[row.story_id]) mediaByStory[row.story_id] = []
        mediaByStory[row.story_id].push({ id: row.id, media_type: row.media_type, url: row.url })
      }
    }

    const stories = (data || []).map((s) => ({ ...s, media: mediaByStory[s.id] || [] }))
    return NextResponse.json({ success: true, stories })
  } catch (err: any) {
    console.error("Public stories route error:", err)
    return NextResponse.json({ success: true, stories: [] })
  }
}
