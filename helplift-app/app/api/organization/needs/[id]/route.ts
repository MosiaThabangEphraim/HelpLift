import { NextResponse } from "next/server"
import { readUploadedFile, readUploadedFiles, isStagedReference } from "@/lib/staged-uploads"
import { checkUploadLimits, UPLOAD_LIMITS } from "@/lib/upload-limits"
import { logUserAction } from "@/lib/activity-log"
import { createClient } from "@/lib/supabase/server"
import { isPastDate } from "@/lib/expiry"
import { getOrgContext, roleAtLeast, insufficientRoleMessage } from "@/lib/organization-access"
import { getActiveCategoryNames } from "@/lib/need-categories"
import { forwardGeocodePlace } from "@/lib/geolocation"
import { notifyAdminsOfNeedChange, notifyNeedSupporters } from "@/lib/need-notifications"

const EDITABLE_FIELDS = new Set(["title", "description", "category", "location", "quantity", "target_amount", "due_date", "urgency"])
// A need can still be edited while it's being worked on, or fixed up after a
// rejection for another admin look; once it's finished (fulfilled/closed)
// its record is treated as a historical log entry.
const EDITABLE_STATUSES = new Set(["draft", "open", "in_progress", "rejected"])

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ message: "Authentication required." }, { status: 401 })
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
    if (profile?.role !== "organization") return NextResponse.json({ message: "Organization access required." }, { status: 403 })
    const orgCtx = await getOrgContext<{ id: any; name: string | null; city: string | null; province: string | null }>(supabase, user.id, "id, name, city, province")
    const organization = orgCtx?.organization ?? null
    if (orgCtx && !roleAtLeast(orgCtx.role, "manager")) return NextResponse.json({ message: insufficientRoleMessage(orgCtx.role, "manager") }, { status: 403 })
    if (!organization) return NextResponse.json({ message: "Organization profile not found." }, { status: 404 })

    const { id } = await context.params
    const { data: existing } = await supabase.from("needs").select("id, status, due_date").eq("id", id).eq("organization_id", organization.id).single()
    if (!existing) return NextResponse.json({ message: "Need not found." }, { status: 404 })

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

    const update: Record<string, any> = {}

    // Status-only transitions an org may make directly (close / mark
    // fulfilled / ask to reopen a need it previously closed). Reopening isn't
    // immediate - it goes back through admin review (enforce_need_publish_rule
    // still blocks anyone but an admin from setting 'open'), so the org must
    // explain why, same as a fresh submission needs approval.
    if (body.status !== undefined) {
      if (!["closed", "fulfilled", "reopen_pending"].includes(body.status)) {
        return NextResponse.json({ message: "Organizations may only close a need, mark it fulfilled, or request to reopen a closed one." }, { status: 400 })
      }
      if (body.status === "reopen_pending") {
        if (existing.status !== "closed") {
          return NextResponse.json({ message: "Only a closed need can be reopened." }, { status: 400 })
        }
        const reason = typeof body.reopen_reason === "string" ? body.reopen_reason.trim() : ""
        if (!reason) {
          return NextResponse.json({ message: "Please explain why you'd like to reopen this need." }, { status: 400 })
        }
        update.reopen_reason = reason
        // A need closed because its due date passed needs a new one, or it
        // would just be closed again (lib/expiry.ts).
        const newDueDate = typeof body.due_date === "string" ? body.due_date.trim() : ""
        if (newDueDate) {
          if (isPastDate(newDueDate)) return NextResponse.json({ message: "The new due date can't be in the past." }, { status: 400 })
          update.due_date = newDueDate
        } else if (isPastDate(existing.due_date)) {
          return NextResponse.json({ message: "This need's due date has passed. Choose a new due date to reopen it." }, { status: 400 })
        }
      }
      update.status = body.status
    }

    // Field edits - only while the need hasn't concluded.
    const hasFieldEdits = Object.keys(body).some(key => EDITABLE_FIELDS.has(key))
    if (hasFieldEdits) {
      if (!EDITABLE_STATUSES.has(existing.status)) {
        return NextResponse.json({ message: "This need can no longer be edited." }, { status: 400 })
      }
      if (body.category !== undefined) {
        const activeCategories = await getActiveCategoryNames(supabase)
        if (!activeCategories.includes(body.category)) {
          return NextResponse.json({ message: `Invalid category. Must be one of: ${activeCategories.join(", ")}.` }, { status: 400 })
        }
      }
      if (body.urgency !== undefined && !["low", "medium", "high"].includes(body.urgency)) {
        return NextResponse.json({ message: "Invalid urgency." }, { status: 400 })
      }
      if (body.title !== undefined && !body.title.trim()) {
        return NextResponse.json({ message: "Title cannot be empty." }, { status: 400 })
      }
      if (body.due_date && isPastDate(body.due_date)) {
        return NextResponse.json({ message: "The due date can't be in the past." }, { status: 400 })
      }
      if (body.description !== undefined && !body.description.trim()) {
        return NextResponse.json({ message: "Description cannot be empty." }, { status: 400 })
      }
      for (const field of EDITABLE_FIELDS) {
        if (body[field] !== undefined) {
          update[field] = body[field] === "" ? null : body[field]
        }
      }

      // Best-effort re-geocode whenever the location text actually changed -
      // never blocks the edit itself if it fails. Falls back to the org's
      // own city/province if the location was cleared out entirely.
      if ("location" in update) {
        try {
          const geocodeQuery = update.location || [organization.city, organization.province].filter(Boolean).join(" ")
          const coords = await forwardGeocodePlace(geocodeQuery)
          update.latitude = coords?.lat ?? null
          update.longitude = coords?.lng ?? null
        } catch (geocodeErr) {
          console.warn("Need geocoding warning:", geocodeErr)
        }
      }
    }

    if (Object.keys(update).length === 0 && attachmentFiles.length === 0) {
      return NextResponse.json({ message: "No updatable fields provided." }, { status: 400 })
    }

    let need = existing
    if (Object.keys(update).length > 0) {
      const { data, error } = await supabase.from("needs").update(update).eq("id", id).eq("organization_id", organization.id).select().single()
      if (error) return NextResponse.json({ message: error.message }, { status: 400 })
      need = data
    }

    // Status changes: admins are told, and so are the givers behind the need
    // once it has ended (lib/need-notifications.ts).
    const needTitle = (need as { title?: string }).title
    if (update.status && update.status !== existing.status && needTitle) {
      const orgName = organization.name || "An organization"
      const changed = { id, title: needTitle }
      await notifyAdminsOfNeedChange(changed, orgName, update.status, update.reopen_reason)
      if (update.status === "closed" || update.status === "fulfilled") await notifyNeedSupporters(changed, orgName, update.status)
    }

    if (attachmentFiles.length > 0) {
      for (const file of attachmentFiles) {
        try {
          const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
          const storagePath = `${user.id}/${crypto.randomUUID()}-${safeName}`
          const { error: uploadError } = await supabase.storage
            .from("need-attachments")
            .upload(storagePath, file, { contentType: file.type || "application/octet-stream", upsert: false })
          if (!uploadError) {
            await supabase.rpc("add_need_attachment", { p_need_id: id, p_storage_path: storagePath, p_file_name: file.name })
          } else {
            console.warn("Need attachment upload warning:", uploadError.message)
          }
        } catch (attachErr) {
          console.warn("Need attachment exception:", attachErr)
        }
      }
    }

    return NextResponse.json({ need })
  } catch (error) {
    console.error("Need update error:", error)
    return NextResponse.json({ message: "Need update is unavailable." }, { status: 503 })
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ message: "Authentication required." }, { status: 401 })
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
    if (profile?.role !== "organization") return NextResponse.json({ message: "Organization access required." }, { status: 403 })
    const orgCtx = await getOrgContext<{ id: any }>(supabase, user.id, "id")
    const organization = orgCtx?.organization ?? null
    if (orgCtx && !roleAtLeast(orgCtx.role, "manager")) return NextResponse.json({ message: insufficientRoleMessage(orgCtx.role, "manager") }, { status: 403 })
    if (!organization) return NextResponse.json({ message: "Organization profile not found." }, { status: 404 })

    const { id } = await context.params
    const { data: existing } = await supabase.from("needs").select("id, status, due_date").eq("id", id).eq("organization_id", organization.id).single()
    if (!existing) return NextResponse.json({ message: "Need not found." }, { status: 404 })

    // Fulfilled/closed is the permanent record of a need that's actually
    // done - donations and fulfillments reference it by need_id, so deleting
    // it here would silently orphan that history even when there's no
    // support_interests row to catch (a monetary donation never creates one).
    if (existing.status === "fulfilled" || existing.status === "closed") {
      return NextResponse.json({ message: "A fulfilled or closed need is a permanent record and can't be deleted." }, { status: 400 })
    }
    // A pending reopen request is awaiting an admin's decision - deleting it
    // out from under that review would leave the request dangling.
    if (existing.status === "reopen_pending") {
      return NextResponse.json({ message: "This need has a reopen request awaiting admin review and can't be deleted yet." }, { status: 400 })
    }

    const { count } = await supabase.from("support_interests").select("id", { count: "exact", head: true }).eq("need_id", id)
    if (count && count > 0) {
      return NextResponse.json({ message: "This need already has giver interest and can't be deleted - close it instead." }, { status: 400 })
    }

    const { error } = await supabase.from("needs").delete().eq("id", id).eq("organization_id", organization.id)
    if (error) return NextResponse.json({ message: error.message }, { status: 400 })

    await logUserAction(supabase, "Deleted a need")
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Need delete error:", error)
    return NextResponse.json({ message: "Need deletion is unavailable." }, { status: 503 })
  }
}
