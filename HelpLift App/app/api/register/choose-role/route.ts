import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { setSignupRole } from "@/lib/google-signup"

// A new Google sign-up chooses whether they're registering as a giver or as an
// organization (on the "Finish signing up" page). Only available while their
// registration is still incomplete, and only for those two account types.
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ message: "Authentication required." }, { status: 401 })

    const { role } = await request.json().catch(() => ({}))
    if (role !== "giver" && role !== "organization") {
      return NextResponse.json({ message: "Choose giver or organization." }, { status: 400 })
    }

    const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single()
    if (!profile || !["giver", "organization"].includes(profile.role) || profile.registration_complete !== false) {
      return NextResponse.json({ message: "Your account type can't be changed here." }, { status: 403 })
    }

    const error = await setSignupRole(createAdminClient(), user, profile, role)
    if (error) return NextResponse.json({ message: error }, { status: 400 })
    return NextResponse.json({ role })
  } catch (error) {
    console.error("Choose signup role error:", error)
    return NextResponse.json({ message: "Could not save your choice right now." }, { status: 503 })
  }
}
