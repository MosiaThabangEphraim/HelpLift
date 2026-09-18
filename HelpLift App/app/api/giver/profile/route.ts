import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

const ALLOWED_ACCOUNT_TYPES = ["individual", "business", "group"] as const

// Self-service update for a giver's OWN record. Keeps `profiles.full_name`/
// `profiles.phone` and `givers.name`/`givers.phone` in sync since both tables
// store the same identity fields (see 20260914000100_help_lift_auth_schema.sql).
//
// `email` is accepted here only as a SYNC field, never to initiate a change —
// the actual login email change happens client-side via
// supabase.auth.updateUser({ email }) + verifyOtp (see ChangeEmailFlow in
// components/account-security.tsx), which is the only path that can update
// auth.users.email. Once that succeeds, the client calls this route with the
// new email so the denormalized copies in profiles/givers (set once at
// registration, never auto-synced by Supabase) don't go stale.
export async function PATCH(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ message: "Authentication required." }, { status: 401 })

    const body = await request.json()

    const fullName = typeof body.full_name === "string" ? body.full_name.trim() : undefined
    const phone = typeof body.phone === "string" ? (body.phone.trim() || null) : undefined
    const accountType = typeof body.account_type === "string" ? body.account_type : undefined
    const preferredCategories = typeof body.preferred_categories === "string" ? body.preferred_categories : undefined
    const preferredLocations = typeof body.preferred_locations === "string" ? body.preferred_locations : undefined
    const email = typeof body.email === "string" ? body.email.trim() : undefined

    if (fullName !== undefined && !fullName) {
      return NextResponse.json({ message: "Name cannot be empty." }, { status: 400 })
    }
    if (accountType !== undefined && !ALLOWED_ACCOUNT_TYPES.includes(accountType as any)) {
      return NextResponse.json({ message: `Invalid account type. Must be one of: ${ALLOWED_ACCOUNT_TYPES.join(", ")}.` }, { status: 400 })
    }
    if (email !== undefined) {
      const basicEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!email || !basicEmail.test(email)) {
        return NextResponse.json({ message: "Invalid email format." }, { status: 400 })
      }
      if (email.toLowerCase() !== user.email?.toLowerCase()) {
        return NextResponse.json({ message: "This email does not match your current login email. Complete the email change first." }, { status: 400 })
      }
    }
    if (fullName === undefined && phone === undefined && accountType === undefined && preferredCategories === undefined && preferredLocations === undefined && email === undefined) {
      return NextResponse.json({ message: "No updatable fields provided." }, { status: 400 })
    }

    const profileUpdate: Record<string, any> = {}
    if (fullName !== undefined) profileUpdate.full_name = fullName
    if (phone !== undefined) profileUpdate.phone = phone
    if (email !== undefined) profileUpdate.email = email

    if (Object.keys(profileUpdate).length > 0) {
      const { error: profileError } = await supabase.from("profiles").update(profileUpdate).eq("id", user.id)
      if (profileError) return NextResponse.json({ message: profileError.message }, { status: 400 })
    }

    const giverUpdate: Record<string, any> = {}
    if (fullName !== undefined) giverUpdate.name = fullName
    if (phone !== undefined) giverUpdate.phone = phone
    if (accountType !== undefined) giverUpdate.account_type = accountType
    if (email !== undefined) giverUpdate.email = email
    if (preferredCategories !== undefined) {
      giverUpdate.preferred_categories = preferredCategories
        .split(",")
        .map((item: string) => item.trim())
        .filter(Boolean)
    }
    if (preferredLocations !== undefined) {
      giverUpdate.preferred_locations = preferredLocations
        .split(",")
        .map((item: string) => item.trim())
        .filter(Boolean)
    }

    const { data: giver, error: giverError } = await supabase
      .from("givers")
      .update(giverUpdate)
      .eq("profile_id", user.id)
      .select("id, name, email, phone, account_type, preferred_categories, preferred_locations")
      .single()

    if (giverError) return NextResponse.json({ message: giverError.message }, { status: 400 })

    return NextResponse.json({ giver })
  } catch (error) {
    console.error("Giver self-profile update error:", error)
    return NextResponse.json({ message: "Profile update is unavailable." }, { status: 503 })
  }
}
