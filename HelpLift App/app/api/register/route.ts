import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { isPasswordValid, isValidEmail } from "@/lib/password"
import { createAdminClient } from "@/lib/supabase/admin"

const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024
const MAX_DOCUMENTS = 10
const ALLOWED_DOCUMENT_EXTENSIONS = /.(pdf|png|jpe?g)$/i

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type") || ""

    let body: Record<string, any> = {}
    let documentFiles: File[] = []
    let documentTypes: string[] = []

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData()
      documentFiles = formData.getAll("documentFiles").filter((f): f is File => f instanceof File && f.size > 0)
      const rawTypes = formData.get("documentTypes")
      if (typeof rawTypes === "string") {
        try {
          const parsed = JSON.parse(rawTypes)
          if (Array.isArray(parsed)) documentTypes = parsed
        } catch { /* fall through to default typing below */ }
      }
      formData.forEach((value, key) => {
        if (typeof value === "string" && key !== "documentTypes") {
          body[key] = value
        }
      })
    } else {
      body = await req.json()
    }

    const { fullName, email, password, phone, role } = body

    if (!fullName || !email || !password || !role) {
      return NextResponse.json(
        { success: false, message: "Name, email, password, and account type are required." },
        { status: 400 }
      )
    }
    if (!["giver", "organization"].includes(role)) {
      return NextResponse.json({ success: false, message: "Choose a valid account type." }, { status: 400 })
    }
    if (!isValidEmail(email)) {
      return NextResponse.json({ success: false, message: "Enter a valid email address." }, { status: 400 })
    }
    if (!isPasswordValid(password)) {
      return NextResponse.json(
        { success: false, message: "Password must be at least 8 characters and include an uppercase letter, a lowercase letter, a number, and a special character." },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          phone,
          role,
          org_name: body.orgName,
          reg_num: body.regNum,
          org_type: body.orgType,
          address: body.address,
          province: body.province,
          city: body.city,
          contact: body.contact,
          mission: body.mission,
          account_type: body.accountType,
          categories: body.categories,
          locations: body.locations,
        },
        emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin}/login?verified=1`,
      },
    })

    if (error) return NextResponse.json({ success: false, message: error.message }, { status: 400 })
    if (data.user && !data.session && data.user.identities?.length === 0) {
      return NextResponse.json(
        { success: false, message: "An account with this email already exists. Sign in or use forgot password." },
        { status: 409 }
      )
    }

    let documentsUploaded = 0
    const documentsFailed: string[] = []

    // If an authenticated session was generated or user created, ensure records exist
    if (data.user) {
      let orgId: string | null = null

      if (role === "organization") {
        // signUp() usually returns NO session (email verification is required),
        // so from here the request is still anonymous. It cannot see the new
        // organization row, write to the private documents bucket or insert
        // document rows (all RLS-protected). The user id comes straight from
        // the signUp result above, so the remaining setup runs with the
        // service role instead. Previously these steps silently failed and the
        // organization ended up with no documents and no banking details.
        const admin = createAdminClient()
        const bankDetails = {
          bank_name: body.bankName || null,
          bank_account_holder: body.bankAccountHolder || null,
          bank_account_number: body.bankAccountNumber || null,
          bank_branch_code: body.bankBranchCode || null,
          bank_account_type: body.bankAccountType || null,
        }

        // The organization row is normally created by the handle_new_profile
        // trigger from the signup metadata; that trigger does not carry the
        // banking details, so add them here.
        const { data: existingOrg } = await admin
          .from("organizations")
          .select("id")
          .eq("profile_id", data.user.id)
          .maybeSingle()

        if (existingOrg) {
          orgId = existingOrg.id
          if (Object.values(bankDetails).some(Boolean)) {
            const { error: bankError } = await admin.from("organizations").update(bankDetails).eq("id", orgId)
            if (bankError) console.warn("Registration banking details error:", bankError.message)
          }
        } else {
          const { data: newOrg, error: orgError } = await admin
            .from("organizations")
            .insert({
              profile_id: data.user.id,
              name: body.orgName || fullName,
              registration_number: body.regNum,
              type: body.orgType || "Other",
              address: body.address,
              province: body.province,
              city: body.city,
              contact_name: body.contact,
              contact_email: email,
              phone,
              mission: body.mission,
              ...bankDetails,
            })
            .select("id")
            .single()
          if (orgError) console.warn("Registration organization insert error:", orgError.message)
          if (newOrg) orgId = newOrg.id
        }

        // Supporting documents (one or many). Anything that cannot be stored is
        // reported back so the user is not told it worked when it did not.
        const filesToStore = documentFiles.slice(0, MAX_DOCUMENTS)
        documentFiles.slice(MAX_DOCUMENTS).forEach(file => documentsFailed.push(file.name))
        for (let i = 0; i < filesToStore.length; i++) {
          const file = filesToStore[i]
          if (!orgId || file.size > MAX_DOCUMENT_BYTES || !ALLOWED_DOCUMENT_EXTENSIONS.test(file.name)) {
            documentsFailed.push(file.name)
            continue
          }
          try {
            const docType = documentTypes[i] || "supporting_document"
            const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
            const storagePath = `${data.user.id}/${crypto.randomUUID()}-${safeName}`

            const { error: uploadError } = await admin.storage
              .from("organization-documents")
              .upload(storagePath, file, {
                contentType: file.type || "application/octet-stream",
                upsert: false,
              })
            if (uploadError) throw new Error(uploadError.message)

            const { error: insertError } = await admin.from("organization_documents").insert({
              organization_id: orgId,
              uploaded_by: data.user.id,
              file_name: file.name,
              storage_path: storagePath,
              document_type: docType,
            })
            if (insertError) {
              await admin.storage.from("organization-documents").remove([storagePath])
              throw new Error(insertError.message)
            }
            documentsUploaded++
          } catch (docErr) {
            console.warn("Registration document upload failed:", file.name, docErr)
            documentsFailed.push(file.name)
          }
        }
      } else {
        const { data: existingGiver } = await supabase
          .from("givers")
          .select("id")
          .eq("profile_id", data.user.id)
          .maybeSingle()

        if (!existingGiver) {
          await supabase.from("givers").insert({
            profile_id: data.user.id,
            name: fullName,
            email,
            phone,
            account_type: body.accountType || "individual",
            preferred_categories: body.categories
              ? body.categories.split(",").map((item: string) => item.trim()).filter(Boolean)
              : [],
            preferred_locations: body.locations
              ? body.locations.split(",").map((item: string) => item.trim()).filter(Boolean)
              : [],
          })
        }
      }
    }

    return NextResponse.json(
      {
        success: true,
        requiresEmailConfirmation: !data.session,
        documentsUploaded,
        documentsFailed,
        message: registrationMessage(!!data.session, role, documentsUploaded, documentsFailed),
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("Supabase registration error:", error)
    return NextResponse.json({ success: false, message: "Registration is unavailable right now." }, { status: 503 })
  }
}

function registrationMessage(hasSession: boolean, role: string, uploaded: number, failed: string[]) {
  const next = hasSession
    ? "You can now sign in."
    : "Check your email to verify your account before signing in."
  if (role !== "organization" || (uploaded === 0 && failed.length === 0)) return `Account created. ${next}`
  if (failed.length === 0) return `Account created with ${uploaded} document${uploaded === 1 ? "" : "s"} attached. ${next}`
  return `Account created, but ${failed.length} document${failed.length === 1 ? "" : "s"} could not be uploaded (${failed.join(", ")}). ${next} Then upload them from the Documents section. Files must be PDF, PNG or JPG under 10 MB.`
}
