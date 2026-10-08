import { NextResponse } from "next/server"
import { readUploadedFile, readUploadedFiles, isStagedReference } from "@/lib/staged-uploads"
import { checkUploadLimits, UPLOAD_LIMITS } from "@/lib/upload-limits"
import { logUserAction } from "@/lib/activity-log"
import { createClient } from "@/lib/supabase/server"
import { isPastDate } from "@/lib/expiry"

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ message: "Authentication required." }, { status: 401 })

    const { data: giver } = await supabase.from("givers").select("id").eq("profile_id", user.id).single()
    if (!giver) return NextResponse.json({ message: "Giver profile not found." }, { status: 404 })

    const { data: gifts, error } = await supabase
      .from("gift_offerings")
      .select("id, title, offering_type, description, quantity_or_value, conditions, location, expiry_date, status, rejection_reason, created_at, organizations(name), gift_offering_photos(id, storage_path, file_name)")
      .eq("giver_id", giver.id)
      .order("created_at", { ascending: false })

    if (error) {
      // Return empty array if table not yet migrated
      return NextResponse.json({ gifts: [] })
    }

    const withPhotoUrls = await Promise.all((gifts || []).map(async (gift: any) => {
      const photos = await Promise.all((gift.gift_offering_photos || []).map(async (p: any) => {
        const { data: signed } = await supabase.storage.from("gift-offering-photos").createSignedUrl(p.storage_path, 3600)
        return { id: p.id, file_name: p.file_name, url: signed?.signedUrl || null }
      }))
      const { gift_offering_photos, ...rest } = gift
      return { ...rest, photos }
    }))

    return NextResponse.json({ gifts: withPhotoUrls })
  } catch (err: any) {
    console.error("Fetch giver gifts error:", err)
    return NextResponse.json({ gifts: [] })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ message: "Authentication required." }, { status: 401 })

    const { data: giver } = await supabase.from("givers").select("id").eq("profile_id", user.id).single()
    if (!giver) return NextResponse.json({ message: "Giver profile not found." }, { status: 404 })

    const contentType = request.headers.get("content-type") || ""
    let title = "", offering_type = "", description = "", quantity_or_value = "", conditions = "", location = "", expiry_date = ""
    let photoFiles: File[] = []

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData()
      title = String(formData.get("title") || "")
      offering_type = String(formData.get("offering_type") || "")
      description = String(formData.get("description") || "")
      quantity_or_value = String(formData.get("quantity_or_value") || "")
      conditions = String(formData.get("conditions") || "")
      location = String(formData.get("location") || "")
      expiry_date = String(formData.get("expiry_date") || "")
      photoFiles = await readUploadedFiles(formData, "photos")
      { const uploadProblem = checkUploadLimits(photoFiles, UPLOAD_LIMITS.giftPhotos); if (uploadProblem) return NextResponse.json({ message: uploadProblem }, { status: 400 }) }
    } else {
      const body = await request.json()
      title = body.title || ""
      offering_type = body.offering_type || ""
      description = body.description || ""
      quantity_or_value = body.quantity_or_value || ""
      conditions = body.conditions || ""
      location = body.location || ""
      expiry_date = body.expiry_date || ""
    }

    if (!title || !description) {
      return NextResponse.json({ message: "Title and description are required." }, { status: 400 })
    }
    if (photoFiles.some(f => f.size > 10 * 1024 * 1024)) {
      return NextResponse.json({ message: "Photos must be smaller than 10 MB each." }, { status: 400 })
    }

    const type = ["goods", "services", "financial"].includes(offering_type) ? offering_type : "goods"
    if (isPastDate(expiry_date)) return NextResponse.json({ message: "The expiry date can't be in the past." }, { status: 400 })

    const { data: gift, error } = await supabase
      .from("gift_offerings")
      .insert({
        giver_id: giver.id,
        title,
        offering_type: type,
        description,
        quantity_or_value: quantity_or_value || null,
        conditions: conditions || null,
        location: location || null,
        expiry_date: expiry_date || null,
        status: "pending",
      })
      .select()
      .single()

    if (error) {
      console.error("Gift insert error:", error.message)
      return NextResponse.json({ message: error.message }, { status: 400 })
    }

    let photosUploaded = 0
    for (const file of photoFiles) {
      try {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
        const storagePath = `${user.id}/${gift.id}/${crypto.randomUUID()}-${safeName}`
        const { error: uploadError } = await supabase.storage
          .from("gift-offering-photos")
          .upload(storagePath, file, { contentType: file.type || "application/octet-stream", upsert: false })
        if (uploadError) {
          console.warn("Gift offering photo upload warning:", uploadError.message)
          continue
        }
        const { error: photoError } = await supabase
          .from("gift_offering_photos")
          .insert({ gift_offering_id: gift.id, storage_path: storagePath, file_name: file.name, uploaded_by: user.id })
        if (photoError) console.warn("Gift offering photo record warning:", photoError.message)
        else photosUploaded++
      } catch (fileErr) {
        console.warn("Gift offering photo exception:", fileErr)
      }
    }

    await logUserAction(supabase, "Pledged to the Gift Library", gift?.title)
    return NextResponse.json({ success: true, gift, photosUploaded }, { status: 201 })
  } catch (err: any) {
    console.error("Create gift offering error:", err)
    return NextResponse.json({ message: "Unable to create offering." }, { status: 503 })
  }
}
