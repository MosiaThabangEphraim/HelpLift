import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { NEED_CATEGORIES } from "@/lib/categories"

// Active need categories, admin-managed. Falls back to the hardcoded default
// list if the migration hasn't been applied yet or the table is empty.
export async function GET() {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("need_categories")
      .select("name")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
    if (error || !data || data.length === 0) {
      return NextResponse.json({ categories: NEED_CATEGORIES })
    }
    return NextResponse.json({ categories: data.map(row => row.name) })
  } catch (error) {
    console.error("Public need categories error:", error)
    return NextResponse.json({ categories: NEED_CATEGORIES })
  }
}
