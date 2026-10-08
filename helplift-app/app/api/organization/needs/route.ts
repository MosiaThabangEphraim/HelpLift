import { NextResponse } from "next/server"
import { readUploadedFile, readUploadedFiles, isStagedReference } from "@/lib/staged-uploads"
import { checkUploadLimits, UPLOAD_LIMITS } from "@/lib/upload-limits"
import { logUserAction } from "@/lib/activity-log"
import { createClient } from "@/lib/supabase/server"
import { isPastDate } from "@/lib/expiry"
import { getActiveCategoryNames } from "@/lib/need-categories"
import { getOrgContext, roleAtLeast, insufficientRoleMessage } from "@/lib/organization-access"
import { forwardGeocodePlace } from "@/lib/geolocation"

async function getOrganizationClient() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, user: null, organization: null, status: 401, message: undefined as string | undefined }
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
  if (profile?.role !== "organization") return { supabase, user, organization: null, status: 403, message: undefined as string | undefined }
  const ctx = await getOrgContext<{ id: string; verification_status: string; city: string | null; province: string | null }>(supabase, user.id, "id, verification_status, city, province")
  if (ctx && !roleAtLeast(ctx.role, "manager")) return { supabase, user, organization: null, status: 403, message: insufficientRoleMessage(ctx.role, "manager") }
  return { supabase, user, organization: ctx?.organization ?? null, status: ctx ? 200 : 404, message: undefined as string | undefined }
}

export async function POST(request: Request) {
  try {
    const { supabase, user, organization, status, message } = await getOrganizationClient()
    if (!organization || !user) return NextResponse.json({ message: message ?? (status === 401 ? "Authentication required." : "Organization access required.") }, { status })

    const contentType = request.headers.get("content-type") || ""
    let body: Record<string, any> = {}
    let attachmentFiles: File[] = []

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData()
      attachmentFiles = await readUploadedFiles(formData, "attachments")
      { const uploadProblem = checkUploadLimits(attachmentFiles, UPLOAD_LIMITS.needAttachments); if (uploadProblem) return NextResponse.json({ message: uploadProblem }, { status: 400 }) }
      formData.forEach((value, key) => {
        if (typeof value === "string" && !isStagedReference(value)) body[key] = value
      })
    } else {
      body = await request.json()
    }

    if (!body.title || !body.description || !body.category) return NextResponse.json({ message: "Title, description, and category are required." }, { status: 400 })
    const activeCategories = await getActiveCategoryNames(supabase)
    if (!activeCategories.includes(body.category)) {
      return NextResponse.json({ message: `Invalid category. Must be one of: ${activeCategories.join(", ")}.` }, { status: 400 })
    }

    const urgency = ["low", "medium", "high"].includes(body.urgency) ? body.urgency : "medium"
    if (isPastDate(body.due_date)) return NextResponse.json({ message: "The due date can't be in the past." }, { status: 400 })

    const insertPayload: Record<string, any> = {
      organization_id: organization.id,
      title: body.title,
      description: body.description,
      category: body.category,
      location: body.location || null,
      quantity: body.quantity || null,
      target_amount: body.target_amount || null,
      due_date: body.due_date || null,
      urgency,
      status: "draft",
    }

    let { data: need, error } = await supabase.from("needs").insert(insertPayload).select().single()
    if (error && error.message?.toLowerCase().includes("urgency")) {
      delete insertPayload.urgency
      const retry = await supabase.from("needs").insert(insertPayload).select().single()
      need = retry.data
      error = retry.error
    }
    if (error) return NextResponse.json({ message: error.message }, { status: 400 })

    // Best-effort - "near me" matching degrades to "not near anyone" for
    // this need if geocoding fails, never blocks the need being created.
    if (need) {
      try {
        const geocodeQuery = need.location || [organization.city, organization.province].filter(Boolean).join(" ")
        const coords = await forwardGeocodePlace(geocodeQuery)
        if (coords) await supabase.from("needs").update({ latitude: coords.lat, longitude: coords.lng }).eq("id", need.id)
      } catch (geocodeErr) {
        console.warn("Need geocoding warning:", geocodeErr)
      }
    }

    if (need && attachmentFiles.length > 0) {
      for (const file of attachmentFiles) {
        try {
          const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
          const storagePath = `${user.id}/${crypto.randomUUID()}-${safeName}`
          const { error: uploadError } = await supabase.storage
            .from("need-attachments")
            .upload(storagePath, file, { contentType: file.type || "application/octet-stream", upsert: false })
          if (!uploadError) {
            await supabase.rpc("add_need_attachment", { p_need_id: need.id, p_storage_path: storagePath, p_file_name: file.name })
          } else {
            console.warn("Need attachment upload warning:", uploadError.message)
          }
        } catch (attachErr) {
          console.warn("Need attachment exception:", attachErr)
        }
      }
    }

    await logUserAction(supabase, "Posted a need", need?.title)
    return NextResponse.json({ need }, { status: 201 })
  } catch (error) {
    console.error("Need creation error:", error)
    return NextResponse.json({ message: "Need creation is unavailable." }, { status: 503 })
  }
}
