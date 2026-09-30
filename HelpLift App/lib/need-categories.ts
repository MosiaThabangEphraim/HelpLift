import type { SupabaseClient } from "@supabase/supabase-js"
import { NEED_CATEGORIES } from "@/lib/categories"

// Active category names, admin-managed (see need_categories in
// 20260924000100_platform_settings.sql). Falls back to the hardcoded default
// list if the migration hasn't been applied yet or the table is empty, so
// need creation never breaks over this.
export async function getActiveCategoryNames(supabase: SupabaseClient): Promise<string[]> {
  const { data, error } = await supabase.from("need_categories").select("name").eq("is_active", true).order("sort_order", { ascending: true })
  if (error || !data || data.length === 0) return [...NEED_CATEGORIES]
  return data.map(row => row.name)
}
