import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

const EDITABLE_FIELDS = new Set(["title", "content", "author_role"])

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ message: "Authentication required." }, { status: 401 })

    const { data: org } = await supabase.from("organizations").select("id").eq("profile_id", user.id).single()
    if (!org) return NextResponse.json({ message: "Organization access required." }, { status: 403 })

    const { id } = await context.params
    const { data: existing } = await supabase.from("impact_stories").select("id").eq("id", id).eq("organization_id", org.id).single()
    if (!existing) return NextResponse.json({ message: "Story not found." }, { status: 404 })

    const contentType = request.headers.get("content-type") || ""
    let body: Record<string, any> = {}

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData()
      formData.forEach((value, key) => {
        if (typeof value === "string") body[key] = value
      })
    } else {
      body = await request.json()
    }

    const update: Record<string, any> = {}
    for (const field of EDITABLE_FIELDS) {
      if (body[field] !== undefined) update[field] = body[field] === "" ? null : body[field]
    }

    if (update.title !== undefined && !String(update.title).trim()) {
      return NextResponse.json({ message: "Title cannot be empty." }, { status: 400 })
    }
    if (update.content !== undefined && !String(update.content).trim()) {
      return NextResponse.json({ message: "Story content cannot be empty." }, { status: 400 })
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ message: "No updatable fields provided." }, { status: 400 })
    }

    const { data: story, error } = await supabase
      .from("impact_stories")
      .update(update)
      .eq("id", id)
      .eq("organization_id", org.id)
      .select()
      .single()
    if (error) return NextResponse.json({ message: error.message }, { status: 400 })

    return NextResponse.json({ story })
  } catch (error) {
    console.error("Story update error:", error)
    return NextResponse.json({ message: "Story update is unavailable." }, { status: 503 })
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ message: "Authentication required." }, { status: 401 })

    const { data: org } = await supabase.from("organizations").select("id").eq("profile_id", user.id).single()
    if (!org) return NextResponse.json({ message: "Organization access required." }, { status: 403 })

    const { id } = await context.params
    const { data: existing } = await supabase.from("impact_stories").select("id").eq("id", id).eq("organization_id", org.id).single()
    if (!existing) return NextResponse.json({ message: "Story not found." }, { status: 404 })

    const { error } = await supabase.from("impact_stories").delete().eq("id", id).eq("organization_id", org.id)
    if (error) return NextResponse.json({ message: error.message }, { status: 400 })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Story delete error:", error)
    return NextResponse.json({ message: "Story deletion is unavailable." }, { status: 503 })
  }
}
