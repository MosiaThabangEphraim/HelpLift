import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ message: "Authentication required." }, { status: 401 })
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
    if (profile?.role !== "giver") return NextResponse.json({ message: "Giver access required." }, { status: 403 })
    const { data: giver } = await supabase.from("givers").select("id").eq("profile_id", user.id).single()
    const { need_id, message } = await request.json()
    if (!giver || !need_id) return NextResponse.json({ message: "A valid need is required." }, { status: 400 })

    const { data: need } = await supabase.from("needs").select("id").eq("id", need_id).in("status", ["open", "in_progress"]).single()
    if (!need) return NextResponse.json({ message: "This need is not open for support." }, { status: 400 })

    const { data: interest, error } = await supabase.from("support_interests").insert({ need_id, giver_id: giver.id, message: message || null }).select().single()
    if (error) return NextResponse.json({ message: error.code === "23505" ? "You have already expressed interest in this need." : error.message }, { status: 400 })
    return NextResponse.json({ interest }, { status: 201 })
  } catch (error) {
    console.error("Interest submission error:", error)
    return NextResponse.json({ message: "Interest submission is unavailable." }, { status: 503 })
  }
}
