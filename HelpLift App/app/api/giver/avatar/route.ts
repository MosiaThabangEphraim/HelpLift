import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

const BUCKET = "profile-pictures"
const MAX_BYTES = 2 * 1024 * 1024
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"]
const ALLOWED_EXTENSIONS = /\.(png|jpe?g|webp)$/i

// The storage path inside the bucket, from a picture's public URL.
function storagePathFromUrl(url: string | null): string | null {
  if (!url) return null
  const marker = `/${BUCKET}/`
  const index = url.indexOf(marker)
  return index >= 0 ? decodeURIComponent(url.slice(index + marker.length).split("?")[0]) : null
}

async function getGiver() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, user: null, giver: null }
  const { data: giver } = await supabase.from("givers").select("id, avatar_url").eq("profile_id", user.id).maybeSingle()
  return { supabase, user, giver }
}

// Upload or replace the giver's own profile picture.
export async function POST(request: Request) {
  try {
    const { supabase, user, giver } = await getGiver()
    if (!user) return NextResponse.json({ message: "Authentication required." }, { status: 401 })
    if (!giver) return NextResponse.json({ message: "Only givers have a profile picture here." }, { status: 403 })

    const formData = await request.formData()
    const file = formData.get("avatar")
    if (!(file instanceof File) || file.size === 0) return NextResponse.json({ message: "Choose an image to upload." }, { status: 400 })
    if (!ALLOWED_TYPES.includes(file.type) || !ALLOWED_EXTENSIONS.test(file.name)) {
      return NextResponse.json({ message: "Use a PNG, JPG or WebP image." }, { status: 400 })
    }
    if (file.size > MAX_BYTES) return NextResponse.json({ message: "The picture must be smaller than 2 MB." }, { status: 400 })

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
    const storagePath = `${user.id}/avatar-${Date.now()}-${safeName}`
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, file, { contentType: file.type, upsert: false })
    if (uploadError) return NextResponse.json({ message: uploadError.message }, { status: 400 })

    const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(storagePath)
    const { error: updateError } = await supabase.from("givers").update({ avatar_url: publicUrl }).eq("id", giver.id)
    if (updateError) {
      await supabase.storage.from(BUCKET).remove([storagePath])
      return NextResponse.json({ message: updateError.message }, { status: 400 })
    }

    // Tidy up the picture this one replaces.
    const previous = storagePathFromUrl(giver.avatar_url)
    if (previous) await supabase.storage.from(BUCKET).remove([previous]).catch(() => undefined)

    return NextResponse.json({ avatar_url: publicUrl })
  } catch (error) {
    console.error("Giver avatar upload error:", error)
    return NextResponse.json({ message: "Could not upload the picture right now." }, { status: 503 })
  }
}

// Remove the giver's profile picture (their initial is shown instead).
export async function DELETE() {
  try {
    const { supabase, user, giver } = await getGiver()
    if (!user) return NextResponse.json({ message: "Authentication required." }, { status: 401 })
    if (!giver) return NextResponse.json({ message: "Only givers have a profile picture here." }, { status: 403 })

    const { error } = await supabase.from("givers").update({ avatar_url: null }).eq("id", giver.id)
    if (error) return NextResponse.json({ message: error.message }, { status: 400 })

    const previous = storagePathFromUrl(giver.avatar_url)
    if (previous) await supabase.storage.from(BUCKET).remove([previous]).catch(() => undefined)
    return NextResponse.json({ avatar_url: null })
  } catch (error) {
    console.error("Giver avatar removal error:", error)
    return NextResponse.json({ message: "Could not remove the picture right now." }, { status: 503 })
  }
}
