import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// Appends photos/videos to an existing story (used by the edit dialog's
// "add more" flow, separate from the main story PATCH so each item can be
// uploaded and confirmed independently).
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ message: "Authentication required." }, { status: 401 })

    const { data: org } = await supabase.from("organizations").select("id").eq("profile_id", user.id).single()
    if (!org) return NextResponse.json({ message: "Organization access required." }, { status: 403 })

    const { id } = await context.params
    const { data: story } = await supabase.from("impact_stories").select("id, image_url, video_url").eq("id", id).eq("organization_id", org.id).single()
    if (!story) return NextResponse.json({ message: "Story not found." }, { status: 404 })

    const formData = await request.formData()
    const imageFiles = formData.getAll("images").filter((f): f is File => f instanceof File && f.size > 0)
    const videoUrls = formData.getAll("video_urls").map((v) => String(v).trim()).filter(Boolean)

    for (const url of videoUrls) {
      try {
        const parsed = new URL(url)
        if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("bad protocol")
      } catch {
        return NextResponse.json({ message: `"${url}" isn't a valid video URL (e.g. a YouTube or Vimeo link).` }, { status: 400 })
      }
    }
    if (imageFiles.length === 0 && videoUrls.length === 0) {
      return NextResponse.json({ message: "Add at least one photo or video." }, { status: 400 })
    }

    const added: { id: string; media_type: string; url: string }[] = []

    for (const imageFile of imageFiles) {
      const safeName = imageFile.name.replace(/[^a-zA-Z0-9._-]/g, "_")
      const storagePath = `${user.id}/${crypto.randomUUID()}-${safeName}`
      const { error: uploadError } = await supabase.storage
        .from("impact-media")
        .upload(storagePath, imageFile, { contentType: imageFile.type || "image/jpeg", upsert: false })
      if (uploadError) return NextResponse.json({ message: uploadError.message }, { status: 400 })
      const { data: publicUrlData } = supabase.storage.from("impact-media").getPublicUrl(storagePath)
      const url = publicUrlData?.publicUrl
      if (!url) continue
      const { data: mediaId, error: mediaError } = await supabase.rpc("add_impact_story_media", {
        p_story_id: id, p_media_type: "image", p_url: url, p_storage_path: null,
      })
      if (mediaError) return NextResponse.json({ message: mediaError.message }, { status: 400 })
      added.push({ id: mediaId as unknown as string, media_type: "image", url })
    }

    for (const url of videoUrls) {
      const { data: mediaId, error: mediaError } = await supabase.rpc("add_impact_story_media", {
        p_story_id: id, p_media_type: "video", p_url: url, p_storage_path: null,
      })
      if (mediaError) return NextResponse.json({ message: mediaError.message }, { status: 400 })
      added.push({ id: mediaId as unknown as string, media_type: "video", url })
    }

    // Backfill the legacy singular columns if the story didn't have one yet.
    const update: Record<string, string> = {}
    if (!story.image_url) {
      const firstImage = added.find((m) => m.media_type === "image")
      if (firstImage) update.image_url = firstImage.url
    }
    if (!story.video_url) {
      const firstVideo = added.find((m) => m.media_type === "video")
      if (firstVideo) update.video_url = firstVideo.url
    }
    if (Object.keys(update).length > 0) {
      await supabase.from("impact_stories").update(update).eq("id", id)
    }

    return NextResponse.json({ media: added }, { status: 201 })
  } catch (error) {
    console.error("Add story media error:", error)
    return NextResponse.json({ message: "Unable to add media right now." }, { status: 503 })
  }
}
