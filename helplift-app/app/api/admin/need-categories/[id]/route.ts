import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ message: "Authentication required." }, { status: 401 }) }
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
  if (profile?.role !== "admin") return { error: NextResponse.json({ message: "Administrator access required." }, { status: 403 }) }
  return { user }
}

// Renaming updates every need already using the old name too (via the
// rename_need_category RPC, so it happens atomically with the row update -
// see 20260924000100_platform_settings.sql), so nothing is orphaned.
// "Retiring" a category is PATCH { is_active: false } - it just stops being
// offered for new/edited needs; needs already using it are untouched.
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient()
    const auth = await requireAdmin(supabase)
    if (auth.error) return auth.error

    const { id } = await context.params
    const body = await request.json().catch(() => ({}))
    const update: Record<string, any> = {}

    if (body.name !== undefined) {
      const newName = typeof body.name === "string" ? body.name.trim() : ""
      if (!newName) return NextResponse.json({ message: "Category name can't be empty." }, { status: 400 })
      const { data: current } = await supabase.from("need_categories").select("name").eq("id", id).single()
      if (!current) return NextResponse.json({ message: "Category not found." }, { status: 404 })
      if (current.name !== newName) {
        const { error: renameError } = await supabase.rpc("rename_need_category", { p_old_name: current.name, p_new_name: newName })
        if (renameError) return NextResponse.json({ message: renameError.message }, { status: 400 })
      }
      update.name = newName
    }
    if (body.is_active !== undefined) update.is_active = !!body.is_active
    if (body.sort_order !== undefined) update.sort_order = Number(body.sort_order) || 0
    if (Object.keys(update).length === 0) return NextResponse.json({ message: "No changes provided." }, { status: 400 })

    const { data: category, error } = await supabase.from("need_categories").update(update).eq("id", id).select().single()
    if (error) {
      const message = /duplicate|unique/i.test(error.message) ? "A category with this name already exists." : error.message
      return NextResponse.json({ message }, { status: 400 })
    }

    return NextResponse.json({ category })
  } catch (error) {
    console.error("Admin need category update error:", error)
    return NextResponse.json({ message: "Could not update this category." }, { status: 503 })
  }
}

// Only a category no need has ever used can be deleted outright; otherwise retire it.
export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient()
    const auth = await requireAdmin(supabase)
    if (auth.error) return auth.error

    const { id } = await context.params
    const { data: category } = await supabase.from("need_categories").select("name").eq("id", id).single()
    if (!category) return NextResponse.json({ message: "Category not found." }, { status: 404 })

    const { count } = await supabase.from("needs").select("id", { count: "exact", head: true }).eq("category", category.name)
    if ((count ?? 0) > 0) {
      return NextResponse.json({ message: "Needs already use this category and it can't be deleted - retire it instead." }, { status: 400 })
    }

    const { error } = await supabase.from("need_categories").delete().eq("id", id)
    if (error) return NextResponse.json({ message: error.message }, { status: 400 })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Admin need category delete error:", error)
    return NextResponse.json({ message: "Could not delete this category." }, { status: 503 })
  }
}
