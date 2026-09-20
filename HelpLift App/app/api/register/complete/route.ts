import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { isPasswordValid } from "@/lib/password"
import { storeOrganizationDocuments } from "@/lib/organization-documents"

const ACCOUNT_TYPES = ["individual", "business", "group"]
const ORGANIZATION_TYPES = ["School", "Church", "Non-Profit", "Welfare Group", "Other"]
const PASSWORD_MESSAGE = "Password must be at least 8 characters and include an uppercase letter, a lowercase letter, a number and a special character."

const splitList = (value: unknown) =>
  typeof value === "string" ? value.split(",").map(item => item.trim()).filter(Boolean) : []
const text = (value: unknown) => (typeof value === "string" ? value.trim() : "")

// Finishes registration for someone who signed up with Google. Google verified
// their email; everything else works like a normal sign-up: the same details as
// the giver or organization registration form, and a password they choose.
// Givers send JSON; organizations send multipart (their documents are files).
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ message: "Authentication required." }, { status: 401 })

    const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single()
    if (!profile || !["giver", "organization"].includes(profile.role)) {
      return NextResponse.json({ message: "This account can't finish registration here." }, { status: 403 })
    }
    if (profile.registration_complete !== false) {
      return NextResponse.json({ message: "Your registration is already complete." }, { status: 400 })
    }

    let body: Record<string, any> = {}
    let documentFiles: File[] = []
    let documentTypes: string[] = []
    if ((request.headers.get("content-type") || "").includes("multipart/form-data")) {
      const formData = await request.formData()
      formData.forEach((value, key) => { if (typeof value === "string") body[key] = value })
      documentFiles = formData.getAll("documentFiles").filter((f): f is File => f instanceof File && f.size > 0)
      try {
        const parsed = JSON.parse(String(formData.get("documentTypes") || "[]"))
        if (Array.isArray(parsed)) documentTypes = parsed
      } catch { /* default document typing below */ }
    } else {
      body = await request.json().catch(() => ({}))
    }

    const password = typeof body.password === "string" ? body.password : ""
    if (!isPasswordValid(password)) return NextResponse.json({ message: PASSWORD_MESSAGE }, { status: 400 })

    const admin = createAdminClient()
    let documentsUploaded = 0
    let documentsFailed: string[] = []

    if (profile.role === "giver") {
      const fullName = text(body.full_name)
      const phone = text(body.phone)
      const accountType = text(body.account_type)
      if (!fullName) return NextResponse.json({ message: "Your name is required." }, { status: 400 })
      if (!phone) return NextResponse.json({ message: "Your phone number is required." }, { status: 400 })
      if (!ACCOUNT_TYPES.includes(accountType)) return NextResponse.json({ message: "Choose an account type." }, { status: 400 })

      // Password first: if it fails, nothing else has changed.
      const { error: passwordError } = await supabase.auth.updateUser({ password })
      if (passwordError) return NextResponse.json({ message: passwordError.message }, { status: 400 })

      const picture = (user.user_metadata?.avatar_url || user.user_metadata?.picture) as string | undefined
      const { error: giverError } = await supabase
        .from("givers")
        .update({
          name: fullName,
          phone,
          account_type: accountType,
          preferred_categories: splitList(body.categories),
          preferred_locations: splitList(body.locations),
          ...(picture ? { avatar_url: picture } : {}),
        })
        .eq("profile_id", user.id)
      if (giverError) return NextResponse.json({ message: giverError.message }, { status: 400 })

      const { error: profileError } = await supabase.from("profiles").update({ full_name: fullName, phone }).eq("id", user.id)
      if (profileError) return NextResponse.json({ message: profileError.message }, { status: 400 })
    } else {
      const orgName = text(body.orgName)
      const orgType = text(body.orgType)
      const contact = text(body.contact)
      const required: [string, string][] = [
        [orgName, "Organization name"], [text(body.regNum), "Registration number"],
        [text(body.address), "Physical address"], [text(body.province), "Province"],
        [text(body.city), "City"], [contact, "Contact person and role"],
      ]
      const missing = required.find(([value]) => !value)
      if (missing) return NextResponse.json({ message: `${missing[1]} is required.` }, { status: 400 })
      if (!ORGANIZATION_TYPES.includes(orgType)) return NextResponse.json({ message: "Choose an organization type." }, { status: 400 })

      const { error: passwordError } = await supabase.auth.updateUser({ password })
      if (passwordError) return NextResponse.json({ message: passwordError.message }, { status: 400 })

      const details = {
        name: orgName,
        registration_number: text(body.regNum),
        type: orgType,
        address: text(body.address),
        province: text(body.province),
        city: text(body.city),
        contact_name: contact,
        contact_email: user.email,
        phone: text(body.phone) || null,
        mission: text(body.mission) || null,
        bank_name: text(body.bankName) || null,
        bank_account_holder: text(body.bankAccountHolder) || null,
        bank_account_number: text(body.bankAccountNumber) || null,
        bank_branch_code: text(body.bankBranchCode) || null,
        bank_account_type: text(body.bankAccountType) || null,
      }
      let { data: org } = await admin.from("organizations").select("id").eq("profile_id", user.id).maybeSingle()
      if (org) {
        const { error } = await admin.from("organizations").update(details).eq("id", org.id)
        if (error) return NextResponse.json({ message: error.message }, { status: 400 })
      } else {
        const { data: created, error } = await admin.from("organizations").insert({ profile_id: user.id, ...details }).select("id").single()
        if (error || !created) return NextResponse.json({ message: error?.message || "Could not create the organization." }, { status: 400 })
        org = created
      }

      await admin.from("profiles").update({ full_name: contact, phone: text(body.phone) || null }).eq("id", user.id)

      if (documentFiles.length > 0 && org) {
        const stored = await storeOrganizationDocuments(admin, { userId: user.id, organizationId: org.id, files: documentFiles, types: documentTypes })
        documentsUploaded = stored.uploaded
        documentsFailed = stored.failed
      }
    }

    // Only the server marks registration complete, after everything above worked.
    const { error: flagError } = await admin.from("profiles").update({ registration_complete: true }).eq("id", user.id)
    if (flagError) return NextResponse.json({ message: flagError.message }, { status: 400 })

    return NextResponse.json({
      success: true,
      role: profile.role,
      documentsUploaded,
      documentsFailed,
      message: documentsFailed.length
        ? `Registration complete, but ${documentsFailed.length} document(s) couldn't be uploaded (${documentsFailed.join(", ")}). You can upload them again from your dashboard.`
        : "Registration complete.",
    })
  } catch (error) {
    console.error("Complete registration error:", error)
    return NextResponse.json({ message: "Could not finish your registration right now." }, { status: 503 })
  }
}
