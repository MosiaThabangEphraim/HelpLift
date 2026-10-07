import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ message: "Authentication required." }, { status: 401 }) }
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
  if (profile?.role !== "admin") return { error: NextResponse.json({ message: "Administrator access required." }, { status: 403 }) }
  return { user }
}

// All categories, active or retired.
export async function GET() {
  try {
    const supabase = await createClient()
    const auth = await requireAdmin(supabase)
    if (auth.error) return auth.error
    const { data, error } = await supabase.from("need_categories").select("*").order("sort_order", { ascending: true })
    if (error) return NextResponse.json({ message: error.message }, { status: 400 })
    return NextResponse.json({ categories: data || [] })
  } catch (error) {
    console.error("Admin need categories list error:", error)
    return NextResponse.json({ message: "Categories are unavailable." }, { status: 503 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const auth = await requireAdmin(supabase)
    if (auth.error) return auth.error

    const body = await request.json().catch(() => ({}))
    const name = typeof body.name === "string" ? body.name.trim() : ""
    if (!name) return NextResponse.json({ message: "A category name is required." }, { status: 400 })

    const { data: maxSort } = await supabase.from("need_categories").select("sort_order").order("sort_order", { ascending: false }).limit(1).maybeSingle()

    const { data: category, error } = await supabase
      .from("need_categories")
      .insert({ name, sort_order: (maxSort?.sort_order ?? 0) + 1 })
      .select()
      .single()
    if (error) {
      const message = /duplicate|unique/i.test(error.message) ? "A category with this name already exists." : error.message
      return NextResponse.json({ message }, { status: 400 })
    }

    return NextResponse.json({ category }, { status: 201 })
  } catch (error) {
    console.error("Admin need category create error:", error)
    return NextResponse.json({ message: "Could not add this category." }, { status: 503 })
  }
}
