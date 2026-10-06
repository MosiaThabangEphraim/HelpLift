import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { logUserAction } from "@/lib/activity-log"
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
    let roleChange: { from: string; to: string } | null = null

    if (typeof body.full_name === "string") {
      if (!body.full_name.trim()) return NextResponse.json({ message: "Full name cannot be empty." }, { status: 400 })
      profileUpdate.full_name = body.full_name.trim()
    }

    if (body.role !== undefined) {
      if (!ALLOWED_ROLES.includes(body.role)) {
        return NextResponse.json({ message: `Invalid role. Must be one of: ${ALLOWED_ROLES.join(", ")}.` }, { status: 400 })
      }
      // Only actually-changed roles are checked, so saving other fields with the same role is always fine.
      const { data: target } = await supabase.from("profiles").select("role, full_name, email").eq("id", id).single()
      if (!target) return NextResponse.json({ message: "User not found." }, { status: 404 })
      if (target.role !== body.role) {
        if (id === currentUser.id) {
          return NextResponse.json({ message: "You can't change your own role. Ask another administrator." }, { status: 400 })
        }
        // Organization accounts own an organization record and giver accounts a giver profile, so
        // the only safe platform moves are giver <-> admin. Team roles inside an organization are
        // changed separately.
        if (target.role === "organization" || body.role === "organization") {
          return NextResponse.json({ message: "Organization accounts can't be converted. Change their team role instead, or delete the account." }, { status: 400 })
        }
        if (body.role === "giver") {
          // A former admin has no giver profile yet; create one so the giver dashboard works.
          const admin = serviceClient()
          const { data: existing } = await admin.from("givers").select("id").eq("profile_id", id).maybeSingle()
          if (!existing) {
            const { error: giverError } = await admin.from("givers").insert({ profile_id: id, name: target.full_name, email: target.email })
            if (giverError) return NextResponse.json({ message: giverError.message }, { status: 400 })
          }
        }
        profileUpdate.role = body.role
        roleChange = { from: target.role as string, to: body.role as string }
      }
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
        console.warn("SUPABASE_SERVICE_ROLE_KEY not set - skipping auth.admin password reset.")
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

    // Giver details live on the givers row: phone, account type - and the
    // giver's display name, kept in step with the profile's full name.
    const giverUpdate: Record<string, string | null> = {}
    if (typeof body.phone === "string") giverUpdate.phone = body.phone.trim() || null
    if (body.account_type !== undefined) {
      if (!["individual", "business", "group"].includes(body.account_type)) {
        return NextResponse.json({ message: "Account type must be individual, business or group." }, { status: 400 })
      }
      giverUpdate.account_type = body.account_type
    }
    if (typeof profileUpdate.full_name === "string") giverUpdate.name = profileUpdate.full_name
    let giverChanged = false
    if (Object.keys(giverUpdate).length > 0) {
      const { data: giverRow } = await serviceClient().from("givers").select("id").eq("profile_id", id).maybeSingle()
      if (giverRow) {
        const { error: giverError } = await serviceClient().from("givers").update(giverUpdate).eq("id", giverRow.id)
        if (giverError) return NextResponse.json({ message: giverError.message }, { status: 400 })
        giverChanged = true
      }
    }

    const hasProfileFields = Object.keys(profileUpdate).length > 0
    if (!hasProfileFields && !passwordChanged && !giverChanged) {
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

      if (roleChange) {
        try {
          await supabase.from("notifications").insert({
            recipient_id: id,
            sender_id: currentUser.id,
            sender_name: "HelpLift Notifications",
            type: "role_changed",
            title: "Your account role changed",
            message: `An administrator changed your HelpLift role from ${roleChange.from} to ${roleChange.to}.${roleChange.to === "admin" ? " You now have access to the admin dashboard." : ""}`,
          })
        } catch (notifyErr) {
          console.warn("Role change notification warning:", notifyErr)
        }
      }

      if ("suspended" in profileUpdate && profileUpdate.suspended !== wasSuspendedBeforeUpdate) {
        try {
          await supabase.from("notifications").insert({
            recipient_id: id,
            sender_id: currentUser.id,
            sender_name: "HelpLift Notifications",
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

    const changes = [
      body.full_name !== undefined && "name",
      body.role !== undefined && "role",
      body.suspended !== undefined && (body.suspended ? "suspended" : "unsuspended"),
      passwordChanged && "password reset",
      (body.phone !== undefined || body.account_type !== undefined) && "giver details",
    ].filter(Boolean).join(", ")
    await logUserAction(supabase, "Edited a user account", `${profile?.full_name || profile?.email || "User"}${changes ? ` - ${changes}` : ""}`)

    return NextResponse.json({ profile })
  } catch (error: any) {
    console.error("Admin user update error:", error)
    return NextResponse.json({ message: error?.message || "User update is unavailable." }, { status: 503 })
  }
}

// Permanently deletes the auth.users row, which cascades down through
// profiles -> organizations/givers -> everything referencing them (needs,
// donations, gift_offerings, notifications, etc. are all FK'd with
// on delete cascade) - a full account wipe in one call, no manual cleanup.
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
      return NextResponse.json({ message: "You can't delete the account you're currently signed in as. Sign in as another administrator to delete this one." }, { status: 400 })
    }

    // Deleting an account cascades to its giver/organization rows - and from
    // there to their donations and withdrawals. Financial records must be
    // kept, so accounts that hold any can't be deleted (suspend them instead).
    const service = serviceClient()
    const [{ data: giverRows }, { data: orgRows }] = await Promise.all([
      service.from("givers").select("id").eq("profile_id", id),
      service.from("organizations").select("id").eq("profile_id", id),
    ])
    const giverIds = (giverRows || []).map((row: any) => row.id)
    const orgIds = (orgRows || []).map((row: any) => row.id)
    const counts = await Promise.all([
      giverIds.length ? service.from("donations").select("id", { count: "exact", head: true }).in("giver_id", giverIds) : Promise.resolve({ count: 0 }),
      orgIds.length ? service.from("donations").select("id", { count: "exact", head: true }).in("organization_id", orgIds) : Promise.resolve({ count: 0 }),
      orgIds.length ? service.from("organization_withdrawals").select("id", { count: "exact", head: true }).in("organization_id", orgIds) : Promise.resolve({ count: 0 }),
    ])
    const financialRecords = counts.reduce((total, result: any) => total + (result.count || 0), 0)
    if (financialRecords > 0) {
      return NextResponse.json({
        message: `This account has ${financialRecords} financial record${financialRecords === 1 ? "" : "s"} (donations or withdrawals), which must be kept - so it can't be deleted. Suspend the account instead.`,
      }, { status: 409 })
    }

    const { data: target } = await service.from("profiles").select("full_name, email, role").eq("id", id).maybeSingle()
    const { error } = await service.auth.admin.deleteUser(id)
    if (error) return NextResponse.json({ message: error.message }, { status: 400 })

    await logUserAction(supabase, "Deleted a user account", `${target?.full_name || target?.email || "User"}${target?.role ? ` (${target.role})` : ""}`)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Admin user delete error:", error)
    return NextResponse.json({ message: error?.message || "User deletion is unavailable." }, { status: 503 })
  }
}
