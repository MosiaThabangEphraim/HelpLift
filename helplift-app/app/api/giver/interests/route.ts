import { NextResponse } from "next/server"
import { readUploadedFile, readUploadedFiles, isStagedReference } from "@/lib/staged-uploads"
import { checkUploadLimits, UPLOAD_LIMITS } from "@/lib/upload-limits"
import { logUserAction } from "@/lib/activity-log"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ message: "Authentication required." }, { status: 401 })
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
    if (profile?.role !== "giver") return NextResponse.json({ message: "Giver access required." }, { status: 403 })
    const { data: giver } = await supabase.from("givers").select("id").eq("profile_id", user.id).single()
    if (!giver) return NextResponse.json({ message: "Giver profile not found." }, { status: 404 })

    const contentType = request.headers.get("content-type") || ""
    let need_id = ""
    let message = ""
    let photoFiles: File[] = []

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData()
      need_id = String(formData.get("need_id") || "")
      message = String(formData.get("message") || "")
      photoFiles = await readUploadedFiles(formData, "photos")
      { const uploadProblem = checkUploadLimits(photoFiles, UPLOAD_LIMITS.interestPhotos); if (uploadProblem) return NextResponse.json({ message: uploadProblem }, { status: 400 }) }
    } else {
      const body = await request.json()
      need_id = body.need_id || ""
      message = body.message || ""
    }

    if (!need_id) return NextResponse.json({ message: "A valid need is required." }, { status: 400 })
    if (photoFiles.some(f => f.size > 10 * 1024 * 1024)) {
      return NextResponse.json({ message: "Photos must be smaller than 10 MB each." }, { status: 400 })
    }

    const { data: need } = await supabase.from("needs").select("id, title, organization_id").eq("id", need_id).in("status", ["open", "in_progress"]).single()
    if (!need) return NextResponse.json({ message: "This need is not open for support." }, { status: 400 })

    const { data: interest, error } = await supabase.from("support_interests").insert({ need_id, giver_id: giver.id, message: message || null }).select().single()
    if (error) return NextResponse.json({ message: error.code === "23505" ? "You have already expressed interest in this need." : error.message }, { status: 400 })

    let photosUploaded = 0
    for (const file of photoFiles) {
      try {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
        const storagePath = `${user.id}/${interest.id}/${crypto.randomUUID()}-${safeName}`
        const { error: uploadError } = await supabase.storage
          .from("support-interest-photos")
          .upload(storagePath, file, { contentType: file.type || "application/octet-stream", upsert: false })
        if (uploadError) {
          console.warn("Interest photo upload warning:", uploadError.message)
          continue
        }
        const { error: photoError } = await supabase
          .from("support_interest_photos")
          .insert({ interest_id: interest.id, storage_path: storagePath, file_name: file.name, uploaded_by: user.id })
        if (photoError) console.warn("Interest photo record warning:", photoError.message)
        else photosUploaded++
      } catch (fileErr) {
        console.warn("Interest photo exception:", fileErr)
      }
    }

    // Best-effort: notify everyone on the organization's team who can act on
    // interests (owners/managers - the same roles allowed to accept/decline
    // one, see api/organization/interests/[id]). send_notification is the
    // single choke point for creating a notification row - it also fires the
    // recipient's email automatically via the notifications-insert webhook
    // (app/api/webhooks/notification-created), so one call here covers both.
    // organization_members isn't readable by a giver's own session (it's
    // team-internal), so the lookup itself needs the admin client; the actual
    // notification is still sent through the giver's own session so it's
    // correctly attributed as coming from them.
    try {
      const { data: giverProfile } = await supabase.from("profiles").select("full_name").eq("id", user.id).single()
      const admin = createAdminClient()
      const { data: members } = await admin
        .from("organization_members")
        .select("profile_id")
        .eq("organization_id", need.organization_id)
        .in("role", ["owner", "manager"])
      const giverName = giverProfile?.full_name || "A giver"
      for (const member of members || []) {
        await supabase.rpc("send_notification", {
          p_recipient: member.profile_id,
          p_type: "interest_submitted",
          p_title: "New interest in your need",
          p_message: `${giverName} expressed interest in "${need.title}".`,
        })
      }
    } catch (notifyErr) {
      console.warn("Interest submission notification warning:", notifyErr)
    }

    await logUserAction(supabase, "Offered to help with a need")
    return NextResponse.json({ interest, photosUploaded }, { status: 201 })
  } catch (error) {
    console.error("Interest submission error:", error)
    return NextResponse.json({ message: "Interest submission is unavailable." }, { status: 503 })
  }
}
