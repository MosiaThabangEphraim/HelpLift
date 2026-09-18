import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { NEED_CATEGORIES } from "@/lib/categories"

async function getOrganizationClient() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, user: null, organization: null, status: 401 }
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
  if (profile?.role !== "organization") return { supabase, user, organization: null, status: 403 }
  const { data: organization } = await supabase.from("organizations").select("id, verification_status").eq("profile_id", user.id).single()
  return { supabase, user, organization, status: organization ? 200 : 404 }
}

export async function POST(request: Request) {
  try {
    const { supabase, user, organization, status } = await getOrganizationClient()
    if (!organization || !user) return NextResponse.json({ message: status === 401 ? "Authentication required." : "Organization access required." }, { status })

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

    if (!body.title || !body.description || !body.category) return NextResponse.json({ message: "Title, description, and category are required." }, { status: 400 })
    if (!(NEED_CATEGORIES as readonly string[]).includes(body.category)) {
      return NextResponse.json({ message: `Invalid category. Must be one of: ${NEED_CATEGORIES.join(", ")}.` }, { status: 400 })
    }

    const urgency = ["low", "medium", "high"].includes(body.urgency) ? body.urgency : "medium"

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

    return NextResponse.json({ need }, { status: 201 })
  } catch (error) {
    console.error("Need creation error:", error)
    return NextResponse.json({ message: "Need creation is unavailable." }, { status: 503 })
  }
}
