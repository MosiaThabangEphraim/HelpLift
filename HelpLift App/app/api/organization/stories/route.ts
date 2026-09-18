import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ message: "Authentication required." }, { status: 401 })

    const { data: org } = await supabase.from("organizations").select("id").eq("profile_id", user.id).single()
    if (!org) return NextResponse.json({ message: "Organization profile not found." }, { status: 404 })

    const { data, error } = await supabase
      .from("impact_stories")
      .select("id, title, content, author_role, image_url, video_url, created_at, need_id")
      .eq("organization_id", org.id)
      .order("created_at", { ascending: false })

    if (error) {
      // Table might not exist yet
      return NextResponse.json({ stories: [] })
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
    return NextResponse.json({ stories })
  } catch (err: any) {
    console.error("Get organization stories error:", err)
    return NextResponse.json({ stories: [] })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ message: "Authentication required." }, { status: 401 })

    const { data: org } = await supabase.from("organizations").select("id, verification_status").eq("profile_id", user.id).single()
    if (!org) return NextResponse.json({ message: "Organization access required." }, { status: 403 })

    const contentType = request.headers.get("content-type") || ""
    let title = ""
    let content = ""
    let authorRole = ""
    let needId: string | null = null
    let imageFiles: File[] = []
    let videoUrls: string[] = []

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData()
      title = String(formData.get("title") || "")
      content = String(formData.get("content") || "")
      authorRole = String(formData.get("author_role") || "")
      needId = (formData.get("need_id") as string) || null
      videoUrls = formData.getAll("video_urls").map((v) => String(v).trim()).filter(Boolean)
      imageFiles = formData.getAll("images").filter((f): f is File => f instanceof File && f.size > 0)
      // Singular fields kept for older callers; new clients send "images"/"video_urls".
      const legacyFile = formData.get("image")
      if (legacyFile instanceof File && legacyFile.size > 0) imageFiles.unshift(legacyFile)
      const legacyVideoUrl = String(formData.get("video_url") || "").trim()
      if (legacyVideoUrl) videoUrls.unshift(legacyVideoUrl)
    } else {
      const body = await request.json()
      title = body.title
      content = body.content
      authorRole = body.author_role
      needId = body.need_id || null
      if (body.video_url) videoUrls = [String(body.video_url).trim()]
    }

    if (!title || !content) {
      return NextResponse.json({ message: "Title and story content are required." }, { status: 400 })
    }

    for (const url of videoUrls) {
      try {
        const parsed = new URL(url)
        if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("bad protocol")
      } catch {
        return NextResponse.json({ message: `"${url}" isn't a valid video URL (e.g. a YouTube or Vimeo link).` }, { status: 400 })
      }
    }

    const uploadedImages: { url: string }[] = []
    for (const imageFile of imageFiles) {
      try {
        const safeName = imageFile.name.replace(/[^a-zA-Z0-9._-]/g, "_")
        const storagePath = `${user.id}/${crypto.randomUUID()}-${safeName}`
        const { error: uploadError } = await supabase.storage
          .from("impact-media")
          .upload(storagePath, imageFile, {
            contentType: imageFile.type || "image/jpeg",
            upsert: false,
          })
        if (!uploadError) {
          const { data: publicUrlData } = supabase.storage.from("impact-media").getPublicUrl(storagePath)
          if (publicUrlData?.publicUrl) uploadedImages.push({ url: publicUrlData.publicUrl })
        }
      } catch (uploadEx) {
        console.warn("Story image upload warning:", uploadEx)
      }
    }

    const { data: story, error } = await supabase
      .from("impact_stories")
      .insert({
        organization_id: org.id,
        need_id: needId,
        title,
        content,
        author_role: authorRole || null,
        image_url: uploadedImages[0]?.url || null,
        video_url: videoUrls[0] || null,
      })
      .select()
      .single()

    if (error) {
      console.error("Story insert error:", error.message)
      return NextResponse.json({ message: error.message }, { status: 400 })
    }

    for (const image of uploadedImages) {
      const { error: mediaError } = await supabase.rpc("add_impact_story_media", {
        p_story_id: story.id,
        p_media_type: "image",
        p_url: image.url,
        p_storage_path: null,
      })
      if (mediaError) console.warn("Story media record warning:", mediaError.message)
    }
    for (const url of videoUrls) {
      const { error: mediaError } = await supabase.rpc("add_impact_story_media", {
        p_story_id: story.id,
        p_media_type: "video",
        p_url: url,
        p_storage_path: null,
      })
      if (mediaError) console.warn("Story media record warning:", mediaError.message)
    }

    return NextResponse.json({ success: true, story }, { status: 201 })
  } catch (err: any) {
    console.error("Post story exception:", err)
    return NextResponse.json({ message: "Unable to publish story right now." }, { status: 503 })
  }
}
