import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const supabase = await createClient()

    // 1. Fetch organization details
    const { data: organization, error: orgError } = await supabase
      .from("organizations")
      .select("id, name, type, city, province, address, contact_email, phone, mission, verification_status, logo_url, created_at")
      .eq("id", id)
      .single()

    if (orgError || !organization) {
      return NextResponse.json({ success: false, message: "Organization not found." }, { status: 404 })
    }

    // 2. Fetch open needs from this organization
    let needs: any[] = []
    try {
      const { data: orgNeeds } = await supabase
        .from("needs")
        .select("id, title, description, category, location, quantity, target_amount, due_date, urgency, status, created_at")
        .eq("organization_id", id)
        .in("status", ["open", "in_progress"])
        .order("created_at", { ascending: false })

      needs = orgNeeds || []
    } catch (needsErr) {
      console.warn("Needs fetch fallback for org profile:", needsErr)
    }

    // 3. Fetch impact stories from this organization, with all their media (defensive)
    let stories: any[] = []
    try {
      const { data: orgStories } = await supabase
        .from("impact_stories")
        .select("id, title, content, author_role, image_url, video_url, created_at")
        .eq("organization_id", id)
        .order("created_at", { ascending: false })

      const storyIds = (orgStories || []).map((s) => s.id)
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

      stories = (orgStories || []).map((s) => ({ ...s, media: mediaByStory[s.id] || [] }))
    } catch (storyErr) {
      // If table doesn't exist yet, return empty list gracefully
      stories = []
    }

    return NextResponse.json({
      success: true,
      organization,
      needs,
      stories,
    })
  } catch (err: any) {
    console.error("Public org profile error:", err)
    return NextResponse.json({ success: false, message: "Unable to load organization profile." }, { status: 500 })
  }
}
