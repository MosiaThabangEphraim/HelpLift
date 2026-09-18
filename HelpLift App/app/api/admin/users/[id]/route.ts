import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createServerClient } from "@supabase/ssr"

const ALLOWED_ROLES = ["admin", "organization", "giver"] as const

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

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user: currentUser } } = await supabase.auth.getUser()
    if (!currentUser) return NextResponse.json({ message: "Authentication required." }, { status: 401 })
    const { data: currentProfile } = await supabase.from("profiles").select("role").eq("id", currentUser.id).single()
    if (currentProfile?.role !== "admin") {
      return NextResponse.json({ message: "Administrator access required." }, { status: 403 })
    }

    const { id } = await context.params
    const body = await request.json()

    const profileUpdate: Record<string, any> = {}

    if (typeof body.full_name === "string") {
      if (!body.full_name.trim()) return NextResponse.json({ message: "Full name cannot be empty." }, { status: 400 })
      profileUpdate.full_name = body.full_name.trim()
    }

    if (body.role !== undefined) {
      if (!ALLOWED_ROLES.includes(body.role)) {
        return NextResponse.json({ message: `Invalid role. Must be one of: ${ALLOWED_ROLES.join(", ")}.` }, { status: 400 })
      }
      profileUpdate.role = body.role
    }

    if (typeof body.suspended === "boolean") {
      profileUpdate.suspended = body.suspended
      profileUpdate.suspended_at = body.suspended ? new Date().toISOString() : null
      profileUpdate.suspended_reason = body.suspended ? (typeof body.suspended_reason === "string" ? body.suspended_reason.trim() || null : null) : null
    }

    let passwordChanged = false
    if (typeof body.password === "string" && body.password) {
      if (body.password.length < 8) {
        return NextResponse.json({ message: "Password must be at least 8 characters." }, { status: 400 })
      }
      passwordChanged = true
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
      if (!serviceRoleKey) {
        console.warn("SUPABASE_SERVICE_ROLE_KEY not set — skipping auth.admin password reset.")
      } else {
        const serviceClient = createServerClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          serviceRoleKey,
          {
            auth: { autoRefreshToken: false, persistSession: false },
            cookies: { getAll: () => [], setAll: () => {} }
          }
        )
        const { error: authError } = await serviceClient.auth.admin.updateUserById(id, { password: body.password })
        if (authError) {
          return NextResponse.json({ message: "Password reset failed: " + authError.message }, { status: 400 })
        }
      }
    }

    const hasProfileFields = Object.keys(profileUpdate).length > 0
    if (!hasProfileFields && !passwordChanged) {
      return NextResponse.json({ message: "No updatable fields provided." }, { status: 400 })
    }

    const wasSuspendedBeforeUpdate = hasProfileFields && "suspended" in profileUpdate
      ? (await supabase.from("profiles").select("suspended").eq("id", id).single()).data?.suspended
      : undefined

    let profile: any = null
    if (hasProfileFields) {
      const { data, error } = await supabase
        .from("profiles")
        .update(profileUpdate)
        .eq("id", id)
        .select("id, full_name, email, role, suspended, suspended_at, suspended_reason, created_at")
        .single()
      if (error) return NextResponse.json({ message: error.message }, { status: 400 })
      profile = data

      if ("suspended" in profileUpdate && profileUpdate.suspended !== wasSuspendedBeforeUpdate) {
        try {
          await supabase.from("notifications").insert({
            recipient_id: id,
            sender_id: currentUser.id,
            type: profileUpdate.suspended ? "account_suspended" : "account_unsuspended",
            title: profileUpdate.suspended ? "Your account has been suspended" : "Your account has been restored",
            message: profileUpdate.suspended
              ? `Your HelpLift account was suspended by an administrator.${profileUpdate.suspended_reason ? ` Reason: ${profileUpdate.suspended_reason}` : ""} You can message an admin to appeal.`
              : "Your HelpLift account has been unsuspended and you now have full access again.",
          })
        } catch (notifyErr) {
          console.warn("Suspension notification warning:", notifyErr)
        }
      }
    } else {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, email, role, suspended, suspended_at, suspended_reason, created_at")
        .eq("id", id)
        .single()
      profile = data
    }

    return NextResponse.json({ profile })
  } catch (error: any) {
    console.error("Admin user update error:", error)
    return NextResponse.json({ message: error?.message || "User update is unavailable." }, { status: 503 })
  }
}

// Permanently deletes the auth.users row, which cascades down through
// profiles -> organizations/givers -> everything referencing them (needs,
// donations, gift_offerings, notifications, etc. are all FK'd with
// on delete cascade) — a full account wipe in one call, no manual cleanup.
export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user: currentUser } } = await supabase.auth.getUser()
    if (!currentUser) return NextResponse.json({ message: "Authentication required." }, { status: 401 })
    const { data: currentProfile } = await supabase.from("profiles").select("role").eq("id", currentUser.id).single()
    if (currentProfile?.role !== "admin") {
      return NextResponse.json({ message: "Administrator access required." }, { status: 403 })
    }

    const { id } = await context.params
    if (id === currentUser.id) {
      return NextResponse.json({ message: "You cannot delete your own admin account from here." }, { status: 400 })
    }

    const { error } = await serviceClient().auth.admin.deleteUser(id)
    if (error) return NextResponse.json({ message: error.message }, { status: 400 })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Admin user delete error:", error)
    return NextResponse.json({ message: error?.message || "User deletion is unavailable." }, { status: 503 })
  }
}
