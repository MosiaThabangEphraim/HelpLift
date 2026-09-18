import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { isPasswordValid, isValidEmail } from "@/lib/password"

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

    // If an authenticated session was generated or user created, ensure records exist
    if (data.user) {
      let orgId: string | null = null

      if (role === "organization") {
        const { data: existingOrg } = await supabase
          .from("organizations")
          .select("id")
          .eq("profile_id", data.user.id)
          .maybeSingle()

        if (existingOrg) {
          orgId = existingOrg.id
        } else {
          const { data: newOrg } = await supabase
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
              bank_name: body.bankName || null,
              bank_account_holder: body.bankAccountHolder || null,
              bank_account_number: body.bankAccountNumber || null,
              bank_branch_code: body.bankBranchCode || null,
              bank_account_type: body.bankAccountType || null,
            })
            .select("id")
            .single()
          if (newOrg) orgId = newOrg.id
        }

        // Process supporting document uploads if provided (one or many)
        if (documentFiles.length > 0 && orgId) {
          for (let i = 0; i < documentFiles.length; i++) {
            try {
              const file = documentFiles[i]
              const docType = documentTypes[i] || "supporting_document"
              const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
              const storagePath = `${data.user.id}/${crypto.randomUUID()}-${safeName}`

              const { error: uploadError } = await supabase.storage
                .from("organization-documents")
                .upload(storagePath, file, {
                  contentType: file.type || "application/octet-stream",
                  upsert: false,
                })

              if (!uploadError) {
                await supabase.from("organization_documents").insert({
                  organization_id: orgId,
                  uploaded_by: data.user.id,
                  file_name: file.name,
                  storage_path: storagePath,
                  document_type: docType,
                })
              } else {
                console.warn("Supporting document upload error:", uploadError.message)
              }
            } catch (docErr) {
              console.warn("Document storage exception during registration:", docErr)
            }
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
        message: data.session
          ? "Account created successfully with documents attached. You can now sign in."
          : "Account created with documents attached. Check your email to verify your account before signing in.",
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("Supabase registration error:", error)
    return NextResponse.json({ success: false, message: "Registration is unavailable right now." }, { status: 503 })
  }
}
