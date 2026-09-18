import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createServerClient } from "@supabase/ssr"

function serviceClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
      cookies: { getAll: () => [], setAll: () => {} },
    }
  )
}

// Self-service permanent account deletion, for givers and organizations
// from their own Settings. Requires re-entering the current password as
// proof of intent — Supabase has no standalone "verify this password"
// endpoint, so this signs in with it; a failed sign-in means it was wrong.
//
// Deleting the auth.users row cascades down through profiles ->
// organizations/givers -> everything referencing them (needs, donations,
// gift_offerings, notifications, etc. are all FK'd with on delete cascade)
// — this one call is a full, permanent wipe of the account's data.
export async function DELETE(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !user.email) return NextResponse.json({ message: "Authentication required." }, { status: 401 })

    const { password } = await request.json()
    if (!password || typeof password !== "string") {
      return NextResponse.json({ message: "Enter your password to confirm." }, { status: 400 })
    }

    const { error: verifyError } = await supabase.auth.signInWithPassword({ email: user.email, password })
    if (verifyError) return NextResponse.json({ message: "Incorrect password." }, { status: 401 })

    const { error } = await serviceClient().auth.admin.deleteUser(user.id)
    if (error) return NextResponse.json({ message: error.message }, { status: 400 })

    try {
      await supabase.auth.signOut()
    } catch {
      // Session may already be invalid now that the user row is gone —
      // the client clears its own state and redirects regardless.
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Account deletion error:", error)
    return NextResponse.json({ message: error?.message || "Account deletion is unavailable right now." }, { status: 503 })
  }
}
