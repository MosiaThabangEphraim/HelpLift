import { NextResponse } from "next/server"
import { fileUrl } from "@/lib/file-links"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ message: "Authentication required." }, { status: 401 })

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
    if (profile?.role !== "admin") return NextResponse.json({ message: "Administrator access required." }, { status: 403 })

    const { data, error } = await supabase
      .from("gift_offerings")
      .select(`
        id, title, offering_type, description, quantity_or_value, conditions, location, expiry_date, status, rejection_reason, created_at,
        givers(name, email), organizations(name),
        gift_claims(id, organization_id, motivation, status, claim_notes, created_at, organizations(name), gift_claim_documents(id, storage_path, file_name)),
        gift_offering_photos(id, storage_path, file_name)
      `)
      .order("created_at", { ascending: false })

    if (error) {
      return NextResponse.json({ gifts: [] })
    }

    const gifts = await Promise.all(
      (data || []).map(async (gift: any) => {
        const claims = await Promise.all(
          (gift.gift_claims || []).map(async (claim: any) => {
            const claimOrg = Array.isArray(claim.organizations) ? claim.organizations[0] : claim.organizations
            const documents = await Promise.all(
              (claim.gift_claim_documents || []).map(async (doc: any) => {
                const signed = { signedUrl: fileUrl("gift-claim-documents", doc.storage_path) }
                return { id: doc.id, file_name: doc.file_name, url: signed?.signedUrl || null }
              })
            )
            return {
              id: claim.id,
              organization_id: claim.organization_id,
              organization_name: claimOrg?.name || "Organization",
              motivation: claim.motivation,
              status: claim.status,
              claim_notes: claim.claim_notes,
              created_at: claim.created_at,
              documents,
            }
          })
        )
        // Newest first, but pending claims - the ones needing a decision - lead.
        claims.sort((a, b) => (a.status === "pending" ? -1 : 1) - (b.status === "pending" ? -1 : 1))
        const photos = await Promise.all(
          (gift.gift_offering_photos || []).map(async (p: any) => {
            const signed = { signedUrl: fileUrl("gift-offering-photos", p.storage_path) }
            return { id: p.id, file_name: p.file_name, url: signed?.signedUrl || null }
          })
        )
        const { gift_claims, gift_offering_photos, ...rest } = gift
        return { ...rest, claims, photos }
      })
    )

    return NextResponse.json({ gifts })
  } catch (err: any) {
    console.error("Admin gifts GET error:", err)
    return NextResponse.json({ gifts: [] })
  }
}
