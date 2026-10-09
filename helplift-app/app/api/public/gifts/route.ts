import { NextResponse, after } from "next/server"
import { fileUrl } from "@/lib/file-links"
import { createClient } from "@/lib/supabase/server"
import { notPastFilter } from "@/lib/expiry"
import { expireOverdueItems } from "@/lib/expiry-job"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get("type")?.trim().toLowerCase()
    const search = searchParams.get("search")?.trim().toLowerCase()
    const location = searchParams.get("location")?.trim().toLowerCase()

    const supabase = await createClient()
    // Safety net for the daily expiry job, after the response is sent.
    after(expireOverdueItems)
    const { data: { user } } = await supabase.auth.getUser()

    // Donor email is only useful (and only appropriate) once someone is
    // signed in to actually act on it - keep it out of the fully public,
    // unauthenticated /gift-library listing.
    const giverFields = user ? "name, email, account_type" : "name, account_type"

    let query = supabase
      .from("gift_offerings")
      .select(`id, title, offering_type, description, quantity_or_value, conditions, location, expiry_date, status, created_at, givers(${giverFields}), gift_offering_photos(id, storage_path, file_name)`)
      .eq("status", "approved")
      // Offerings past their expiry date come off straight away (lib/expiry.ts).
      .or(notPastFilter("expiry_date"))
      .order("created_at", { ascending: false })

    if (type && type !== "all" && ["goods", "services", "financial"].includes(type)) {
      query = query.eq("offering_type", type)
    }
    if (location) {
      query = query.ilike("location", `%${location}%`)
    }

    const { data, error } = await query

    if (error) {
      // Table may not exist yet
      return NextResponse.json({ success: true, gifts: [] })
    }

    let filtered = data || []
    if (search) {
      filtered = filtered.filter((g: any) =>
        g.title?.toLowerCase().includes(search) ||
        g.description?.toLowerCase().includes(search) ||
        g.conditions?.toLowerCase().includes(search)
      )
    }

    filtered = await Promise.all(filtered.map(async (g: any) => {
      const photos = await Promise.all((g.gift_offering_photos || []).map(async (p: any) => {
        const signed = { signedUrl: fileUrl("gift-offering-photos", p.storage_path) }
        return { id: p.id, file_name: p.file_name, url: signed?.signedUrl || null }
      }))
      const { gift_offering_photos, ...rest } = g
      return { ...rest, photos }
    }))

    // If an organization is signed in, tell it which of these it already has
    // a pending claim on - several orgs may have a claim in at once, but a
    // given org can't submit a second one on the same offering while its
    // first is still awaiting a decision.
    if (user && filtered.length > 0) {
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
      if (profile?.role === "organization") {
        const { data: membership } = await supabase.from("organization_members").select("organization_id").eq("profile_id", user.id).maybeSingle()
        if (membership?.organization_id) {
          const { data: pending } = await supabase
            .from("gift_claims")
            .select("gift_offering_id")
            .eq("organization_id", membership.organization_id)
            .eq("status", "pending")
            .in("gift_offering_id", filtered.map((g: any) => g.id))
          const pendingIds = new Set((pending || []).map((row: any) => row.gift_offering_id))
          filtered = filtered.map((g: any) => ({ ...g, my_claim_pending: pendingIds.has(g.id) }))
        }
      }
    }

    return NextResponse.json({ success: true, gifts: filtered })
  } catch (err: any) {
    console.error("Public gifts error:", err)
    return NextResponse.json({ success: true, gifts: [] })
  }
}
