import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ message: "Authentication required." }, { status: 401 })

    const { data: giver } = await supabase.from("givers").select("id").eq("profile_id", user.id).single()
    if (!giver) return NextResponse.json({ message: "Giver profile not found." }, { status: 404 })

    const { data: gifts, error } = await supabase
      .from("gift_offerings")
      .select("id, title, offering_type, description, quantity_or_value, conditions, location, expiry_date, status, created_at")
      .eq("giver_id", giver.id)
      .order("created_at", { ascending: false })

    if (error) {
      // Return empty array if table not yet migrated
      return NextResponse.json({ gifts: [] })
    }
    return NextResponse.json({ gifts: gifts || [] })
  } catch (err: any) {
    console.error("Fetch giver gifts error:", err)
    return NextResponse.json({ gifts: [] })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ message: "Authentication required." }, { status: 401 })

    const { data: giver } = await supabase.from("givers").select("id").eq("profile_id", user.id).single()
    if (!giver) return NextResponse.json({ message: "Giver profile not found." }, { status: 404 })

    const body = await request.json()
    const { title, offering_type, description, quantity_or_value, conditions, location, expiry_date } = body

    if (!title || !description) {
      return NextResponse.json({ message: "Title and description are required." }, { status: 400 })
    }

    const type = ["goods", "services", "financial"].includes(offering_type) ? offering_type : "goods"

    const { data: gift, error } = await supabase
      .from("gift_offerings")
      .insert({
        giver_id: giver.id,
        title,
        offering_type: type,
        description,
        quantity_or_value: quantity_or_value || null,
        conditions: conditions || null,
        location: location || null,
        expiry_date: expiry_date || null,
        status: "pending",
      })
      .select()
      .single()

    if (error) {
      console.error("Gift insert error:", error.message)
      return NextResponse.json({ message: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true, gift }, { status: 201 })
  } catch (err: any) {
    console.error("Create gift offering error:", err)
    return NextResponse.json({ message: "Unable to create offering." }, { status: 503 })
  }
}
