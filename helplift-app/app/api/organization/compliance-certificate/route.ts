import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getOrgContext } from "@/lib/organization-access"
import { generateComplianceCertificatePdf } from "@/lib/compliance-certificate-pdf"

// Downloadable proof of HelpLift's own verification, for a verified
// organization to hand to a funder/partner - only ever generated for an
// organization whose verification_status is "approved" right now (checked
// fresh on every request, not cached), so it can never claim compliance
// that's since lapsed. Any team member may download it, same read bar as
// the rest of the org dashboard.
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ message: "Authentication required." }, { status: 401 })

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
    if (profile?.role !== "organization") return NextResponse.json({ message: "Organization access required." }, { status: 403 })

    const orgCtx = await getOrgContext<{
      id: string
      name: string
      type: string
      registration_number: string | null
      address: string | null
      city: string | null
      province: string | null
      verification_status: string
    }>(supabase, user.id, "id, name, type, registration_number, address, city, province, verification_status")
    const organization = orgCtx?.organization ?? null
    if (!organization) return NextResponse.json({ message: "Your organization profile could not be found." }, { status: 404 })

    if (organization.verification_status !== "approved") {
      return NextResponse.json({ message: "This certificate is only available once your organization is verified." }, { status: 403 })
    }

    const issuedAt = new Date().toLocaleDateString("en-ZA", { year: "numeric", month: "long", day: "numeric" })
    const pdfBuffer = await generateComplianceCertificatePdf({
      orgName: organization.name,
      orgType: organization.type,
      registrationNumber: organization.registration_number,
      address: organization.address,
      city: organization.city,
      province: organization.province,
      issuedAt,
    })

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="HelpLift-Certificate-of-Compliance-${organization.name.replace(/[^a-z0-9]+/gi, "-")}.pdf"`,
      },
    })
  } catch (error) {
    console.error("Compliance certificate error:", error)
    return NextResponse.json({ message: "Unable to generate the certificate right now." }, { status: 503 })
  }
}
