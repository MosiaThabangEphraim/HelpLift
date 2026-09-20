import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getOrgContext, roleAtLeast, insufficientRoleMessage } from "@/lib/organization-access"

// Self-service update for an organization's OWN record. Deliberately does not
// include `verification_status` in the allowlist — that field is admin-only
// (see api/admin/organizations/[id]/route.ts). RLS already restricts organizations
// to their own row (profile_id = auth.uid()), but the field allowlist is enforced
// here too so an organization can never grant itself "approved" status by editing
// its own profile. A DB trigger (organizations_guard_verification) backs this up
// at the RLS layer too, and is what actually allows the one exception below:
// resubmitting for review after an admin requests more info.
const ALLOWED_FIELDS = new Set([
  "name",
  "type",
  "registration_number",
  "contact_name",
  "contact_role",
  "contact_email",
  "phone",
  "address",
  "city",
  "province",
  "mission",
  "bank_name",
  "bank_account_holder",
  "bank_account_number",
  "bank_branch_code",
  "bank_account_type",
])

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ message: "Authentication required." }, { status: 401 })

    const orgCtx = await getOrgContext(supabase, user.id)
    if (!orgCtx) return NextResponse.json({ message: "Organization profile not found." }, { status: 404 })
    if (!roleAtLeast(orgCtx.role, "owner")) {
      return NextResponse.json({ message: insufficientRoleMessage(orgCtx.role, "owner") }, { status: 403 })
    }

    const contentType = request.headers.get("content-type") || ""
    let raw: Record<string, any> = {}
    let logoFile: File | null = null

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData()
      formData.forEach((value, key) => {
        if (key === "logo" && value instanceof File && value.size > 0) {
          logoFile = value
        } else if (typeof value === "string") {
          raw[key] = value
        }
      })
    } else {
      raw = await request.json()
    }

    const update: Record<string, any> = {}
    for (const key of Object.keys(raw)) {
      if (ALLOWED_FIELDS.has(key)) {
        const value = raw[key]
        update[key] = typeof value === "string" ? (value.trim() || null) : value
      }
    }

    if (update.name !== undefined && !update.name) {
      return NextResponse.json({ message: "Organization name cannot be empty." }, { status: 400 })
    }
    if (update.type !== undefined && !update.type) {
      return NextResponse.json({ message: "Organization type cannot be empty." }, { status: 400 })
    }
    if (update.contact_email !== undefined) {
      const basicEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!update.contact_email || !basicEmail.test(update.contact_email)) {
        return NextResponse.json({ message: "Invalid email format for contact_email." }, { status: 400 })
      }
    }

    // `login_email` is a sync-only field (see api/giver/profile/route.ts for
    // why): it never initiates a change, it just records the already-confirmed
    // new auth email into profiles.email once ChangeEmailFlow's verifyOtp
    // succeeds. Not part of ALLOWED_FIELDS since it targets profiles, not
    // organizations.
    let loginEmailUpdate: string | undefined
    if (typeof raw.login_email === "string") {
      const loginEmail = raw.login_email.trim()
      const basicEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!loginEmail || !basicEmail.test(loginEmail)) {
        return NextResponse.json({ message: "Invalid login email format." }, { status: 400 })
      }
      if (loginEmail.toLowerCase() !== user.email?.toLowerCase()) {
        return NextResponse.json({ message: "This email does not match your current login email. Complete the email change first." }, { status: 400 })
      }
      loginEmailUpdate = loginEmail
    }

    if (logoFile) {
      try {
        const file = logoFile as File
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
        const storagePath = `${user.id}/logo-${Date.now()}-${safeName}`
        const { error: uploadError } = await supabase.storage
          .from("organization-branding")
          .upload(storagePath, file, { contentType: file.type || "application/octet-stream", upsert: false })
        if (uploadError) return NextResponse.json({ message: uploadError.message }, { status: 400 })
        const { data: publicUrlData } = supabase.storage.from("organization-branding").getPublicUrl(storagePath)
        update.logo_url = publicUrlData.publicUrl
      } catch (logoErr) {
        console.warn("Logo upload exception:", logoErr)
        return NextResponse.json({ message: "Logo upload failed." }, { status: 400 })
      }
    }

    // Resubmitting for review after an admin requested more information —
    // the only status transition an organization may make on its own, and
    // only enforced/allowed if current status really is 'more_info_requested'
    // (the organizations_guard_verification trigger rejects anything else).
    if (raw.resubmit === "true" || raw.resubmit === true) {
      update.verification_status = "pending"
    }

    if (Object.keys(update).length === 0 && loginEmailUpdate === undefined) {
      return NextResponse.json({ message: "No updatable fields provided." }, { status: 400 })
    }

    if (loginEmailUpdate) {
      const { error: profileError } = await supabase.from("profiles").update({ email: loginEmailUpdate }).eq("id", user.id)
      if (profileError) return NextResponse.json({ message: profileError.message }, { status: 400 })
    }

    let organization = null
    if (Object.keys(update).length > 0) {
      const { data, error } = await supabase
        .from("organizations")
        .update(update)
        .eq("id", orgCtx.organization.id)
        .select("id, name, type, registration_number, contact_name, contact_role, contact_email, phone, address, city, province, mission, bank_name, bank_account_holder, bank_account_number, bank_branch_code, bank_account_type, verification_status, verification_notes, logo_url")
        .single()
      if (error) return NextResponse.json({ message: error.message }, { status: 400 })
      organization = data
    }

    return NextResponse.json({ organization })
  } catch (error) {
    console.error("Organization self-profile update error:", error)
    return NextResponse.json({ message: "Organization profile update is unavailable." }, { status: 503 })
  }
}
