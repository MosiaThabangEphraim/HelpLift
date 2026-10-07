import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { lookupAdminInvitation } from "@/lib/invitations"
import { isPasswordValid } from "@/lib/password"

// Creates a brand-new admin account for the invited email in one step. The
// invitation email already proves the person controls the address (they hold
// the token), so the account is created pre-confirmed rather than sending a
// second verification email.
export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await context.params
    const admin = createAdminClient()
    const invite = await lookupAdminInvitation(admin, token)
    if (!invite) return NextResponse.json({ message: "This invitation link isn't valid." }, { status: 404 })
    if (invite.status !== "valid") {
      const reason = invite.status === "accepted" ? "already been used" : invite.status === "revoked" ? "been cancelled" : "expired"
      return NextResponse.json({ message: `This invitation has ${reason}.` }, { status: 410 })
    }

    const body = await request.json().catch(() => ({}))
    const fullName = typeof body.full_name === "string" ? body.full_name.trim() : ""
    const password = typeof body.password === "string" ? body.password : ""
    if (!fullName) return NextResponse.json({ message: "Your name is required." }, { status: 400 })
    if (!isPasswordValid(password)) {
      return NextResponse.json({ message: "Password must be at least 8 characters with an uppercase letter, a lowercase letter, a number and a special character." }, { status: 400 })
    }

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: invite.email,
      password,
      email_confirm: true,
      user_metadata: { role: "giver", full_name: fullName },
    })
    if (createError || !created?.user) {
      const alreadyExists = /already|registered|exists/i.test(createError?.message || "")
      return NextResponse.json(
        { message: alreadyExists ? "An account with this email already exists. Sign in instead." : createError?.message || "Could not create your account." },
        { status: alreadyExists ? 409 : 400 }
      )
    }

    // handle_new_user() creates a giver profile row for the new account (role
    // "giver" above); promote it to admin now that it exists.
    const { error: roleError } = await admin.from("profiles").update({ role: "admin" }).eq("id", created.user.id)
    if (roleError) {
      await admin.auth.admin.deleteUser(created.user.id)
      return NextResponse.json({ message: roleError.message }, { status: 400 })
    }

    await admin.from("admin_invitations").update({ accepted_at: new Date().toISOString() }).eq("id", invite.id)
    return NextResponse.json({ message: "Account created.", email: invite.email }, { status: 201 })
  } catch (error) {
    console.error("Admin invitation register error:", error)
    return NextResponse.json({ message: "Could not create your account." }, { status: 503 })
  }
}
