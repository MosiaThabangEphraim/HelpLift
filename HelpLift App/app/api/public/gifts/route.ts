import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get("type")?.trim().toLowerCase()
    const search = searchParams.get("search")?.trim().toLowerCase()
    const location = searchParams.get("location")?.trim().toLowerCase()

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    // Donor email is only useful (and only appropriate) once someone is
    // signed in to actually act on it — keep it out of the fully public,
    // unauthenticated /gift-library listing.
    const giverFields = user ? "name, email, account_type" : "name, account_type"

    let query = supabase
      .from("gift_offerings")
      .select(`id, title, offering_type, description, quantity_or_value, conditions, location, expiry_date, status, created_at, givers(${giverFields})`)
      .eq("status", "approved")
      .order("created_at", { ascending: false })

    if (type && type !== "all" && ["goods", "services", "financial"].includes(type)) {
      query = query.eq("offering_type", type)
    }
    if (location) {
      query = query.ilike("location", `%${location}%`)
    }

    const { data, error } = await query

    if (error) {
      // Table may not exist yet
      return NextResponse.json({ success: true, gifts: [] })
    }

    let filtered = data || []
    if (search) {
      filtered = filtered.filter((g: any) =>
        g.title?.toLowerCase().includes(search) ||
        g.description?.toLowerCase().includes(search) ||
        g.conditions?.toLowerCase().includes(search)
      )
    }

    return NextResponse.json({ success: true, gifts: filtered })
  } catch (err: any) {
    console.error("Public gifts error:", err)
    return NextResponse.json({ success: true, gifts: [] })
  }
}
