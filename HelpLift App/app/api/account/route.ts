import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createServerClient } from "@supabase/ssr"
import { getOrgContext } from "@/lib/organization-access"
import { transferMemberDocuments } from "@/lib/organization-team"

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

    // Organization team members: deleting an account must not take the
    // organization (or its documents) down with it.
    //  - The original account holder (organizations.profile_id) owns the
    //    organization row, which cascades away with their profile. If another
    //    owner exists, hand the organization to them first; if only
    //    non-owners remain, refuse until someone is promoted to owner.
    //  - Anyone else just leaves; the documents they uploaded are handed on.
    const orgCtx = await getOrgContext<{ id: string; profile_id: string }>(supabase, user.id, "id, profile_id")
    if (orgCtx) {
      const admin = serviceClient()
      const orgId = orgCtx.organization.id
      let heirId = orgCtx.organization.profile_id
      if (orgCtx.organization.profile_id === user.id) {
        const { data: others } = await admin.from("organization_members").select("profile_id, role").eq("organization_id", orgId).neq("profile_id", user.id)
        if ((others || []).length > 0) {
          const heir = others!.find(m => m.role === "owner")
          if (!heir) {
            return NextResponse.json({ message: "Your organization still has team members. Promote one of them to owner first (Team tab), then delete your account." }, { status: 400 })
          }
          const { error: handoverError } = await admin.from("organizations").update({ profile_id: heir.profile_id }).eq("id", orgId)
          if (handoverError) return NextResponse.json({ message: handoverError.message }, { status: 400 })
          heirId = heir.profile_id
        }
      }
      if (heirId !== user.id) {
        const transferError = await transferMemberDocuments(admin, orgId, user.id, heirId)
        if (transferError) return NextResponse.json({ message: transferError }, { status: 500 })
      }
    }

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
