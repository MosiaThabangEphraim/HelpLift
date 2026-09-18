import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search")?.trim().toLowerCase()
    const category = searchParams.get("category")?.trim()
    const urgency = searchParams.get("urgency")?.trim().toLowerCase()
    const location = searchParams.get("location")?.trim()

    const supabase = await createClient()

    // Try query with urgency column
    let query = supabase
      .from("needs")
      .select("id, title, description, category, location, quantity, target_amount, due_date, status, urgency, created_at, organizations(id, name, type, verification_status, city, province), need_attachments(id, storage_path, file_name)")
      .in("status", ["open", "in_progress"])
      .order("created_at", { ascending: false })

    if (category && category !== "All") {
      query = query.ilike("category", `%${category}%`)
    }
    if (urgency && urgency !== "all" && ["low", "medium", "high"].includes(urgency)) {
      query = query.eq("urgency", urgency)
    }
    if (location) {
      query = query.ilike("location", `%${location}%`)
    }

    let { data, error } = await query

    // Fallback if urgency column does not exist yet
    if (error && error.message?.toLowerCase().includes("urgency")) {
      let fallbackQuery = supabase
        .from("needs")
        .select("id, title, description, category, location, quantity, target_amount, due_date, status, created_at, organizations(id, name, type, verification_status, city, province)")
        .in("status", ["open", "in_progress"])
        .order("created_at", { ascending: false })

      if (category && category !== "All") {
        fallbackQuery = fallbackQuery.ilike("category", `%${category}%`)
      }
      if (location) {
        fallbackQuery = fallbackQuery.ilike("location", `%${location}%`)
      }

      const retry = await fallbackQuery
      data = (retry.data || []).map((item: any) => ({ ...item, urgency: "medium" }))
      error = retry.error
    }

    if (error) {
      console.error("Public needs fetch error:", error)
      return NextResponse.json({ success: false, message: error.message, needs: [] }, { status: 500 })
    }

    let filtered = data || []
    if (search) {
      filtered = filtered.filter((item: any) =>
        item.title?.toLowerCase().includes(search) ||
        item.description?.toLowerCase().includes(search) ||
        item.category?.toLowerCase().includes(search)
      )
    }

    filtered = filtered.map((item: any) => ({
      ...item,
      need_attachments: (item.need_attachments || []).map((a: any) => ({
        id: a.id,
        file_name: a.file_name,
        url: supabase.storage.from("need-attachments").getPublicUrl(a.storage_path).data.publicUrl,
      })),
    }))

    return NextResponse.json({ success: true, needs: filtered })
  } catch (err: any) {
    console.error("Public needs route error:", err)
    return NextResponse.json({ success: false, message: "Could not retrieve needs", needs: [] }, { status: 500 })
  }
}
