import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getOrgContext, roleAtLeast, insufficientRoleMessage } from "@/lib/organization-access"
import { NEED_CATEGORIES } from "@/lib/categories"

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
    const orgCtx = await getOrgContext<{ id: any }>(supabase, user.id, "id")
    const organization = orgCtx?.organization ?? null
    if (orgCtx && !roleAtLeast(orgCtx.role, "manager")) return NextResponse.json({ message: insufficientRoleMessage(orgCtx.role, "manager") }, { status: 403 })
    if (!organization) return NextResponse.json({ message: "Organization profile not found." }, { status: 404 })

    const { id } = await context.params
    const { data: existing } = await supabase.from("needs").select("id, status").eq("id", id).eq("organization_id", organization.id).single()
    if (!existing) return NextResponse.json({ message: "Need not found." }, { status: 404 })

    const contentType = request.headers.get("content-type") || ""
    let body: Record<string, any> = {}
    let attachmentFiles: File[] = []

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData()
      attachmentFiles = formData.getAll("attachments").filter((f): f is File => f instanceof File && f.size > 0)
      formData.forEach((value, key) => {
        if (typeof value === "string") body[key] = value
      })
    } else {
      body = await request.json()
    }

    const update: Record<string, any> = {}

    // Status-only transitions an org may make directly (close / mark fulfilled).
    if (body.status !== undefined) {
      if (!["closed", "fulfilled"].includes(body.status)) {
        return NextResponse.json({ message: "Organizations may only close a need or mark it fulfilled." }, { status: 400 })
      }
      update.status = body.status
    }

    // Field edits — only while the need hasn't concluded.
    const hasFieldEdits = Object.keys(body).some(key => EDITABLE_FIELDS.has(key))
    if (hasFieldEdits) {
      if (!EDITABLE_STATUSES.has(existing.status)) {
        return NextResponse.json({ message: "This need can no longer be edited." }, { status: 400 })
      }
      if (body.category !== undefined && !(NEED_CATEGORIES as readonly string[]).includes(body.category)) {
        return NextResponse.json({ message: `Invalid category. Must be one of: ${NEED_CATEGORIES.join(", ")}.` }, { status: 400 })
      }
      if (body.urgency !== undefined && !["low", "medium", "high"].includes(body.urgency)) {
        return NextResponse.json({ message: "Invalid urgency." }, { status: 400 })
      }
      if (body.title !== undefined && !body.title.trim()) {
        return NextResponse.json({ message: "Title cannot be empty." }, { status: 400 })
      }
      if (body.description !== undefined && !body.description.trim()) {
        return NextResponse.json({ message: "Description cannot be empty." }, { status: 400 })
      }
      for (const field of EDITABLE_FIELDS) {
        if (body[field] !== undefined) {
          update[field] = body[field] === "" ? null : body[field]
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
    const { data: existing } = await supabase.from("needs").select("id").eq("id", id).eq("organization_id", organization.id).single()
    if (!existing) return NextResponse.json({ message: "Need not found." }, { status: 404 })

    const { count } = await supabase.from("support_interests").select("id", { count: "exact", head: true }).eq("need_id", id)
    if (count && count > 0) {
      return NextResponse.json({ message: "This need already has giver interest and can't be deleted — close it instead." }, { status: 400 })
    }

    const { error } = await supabase.from("needs").delete().eq("id", id).eq("organization_id", organization.id)
    if (error) return NextResponse.json({ message: error.message }, { status: 400 })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Need delete error:", error)
    return NextResponse.json({ message: "Need deletion is unavailable." }, { status: 503 })
  }
}
