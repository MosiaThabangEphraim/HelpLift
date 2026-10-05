import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

// Cached for a minute so the homepage's live feed polling doesn't hit the database each time.
export const revalidate = 60

// Recent platform activity for the homepage's live feed. Visitors can't read
// donations or interests themselves, so this uses the service-role client - and
// returns only anonymised sentences: never a giver's name, an amount, or any
// other personal detail. Organization names are fine (their profiles are public).

type ActivityType = "donation" | "interest" | "need_posted" | "need_fulfilled" | "organization_joined" | "story" | "gift"
// Events about a named organization carry its public logo (or name, for the initial fallback).
type ActivityItem = { id: string; type: ActivityType; text: string; at: string; href?: string; org?: { name: string; logo: string | null } }

const PER_SOURCE = 10
const MAX_ITEMS = 20

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

// "an Education need", "a Clothing need"
function withArticle(word: string) {
  return /^[aeiou]/i.test(word) ? `an ${word}` : `a ${word}`
}

function orgInfo(org: { name?: string | null; logo_url?: string | null } | null | undefined) {
  return org?.name ? { name: org.name, logo: org.logo_url || null } : undefined
}

function inProvince(province: string | null | undefined) {
  return province ? ` in ${province}` : ""
}

export async function GET() {
  try {
    const admin = createAdminClient()
    const recent = (table: string, columns: string, apply: (q: any) => any, orderBy = "created_at") =>
      apply(admin.from(table).select(columns)).order(orderBy, { ascending: false }).limit(PER_SOURCE)

    const [donations, interests, posted, fulfilled, organizations, stories, gifts] = await Promise.all([
      recent("donations", "id, is_platform_donation, reviewed_at, updated_at, needs(category), organizations(province)", q => q.eq("status", "successful"), "updated_at"),
      recent("support_interests", "id, created_at, needs(category, organizations(province))", q => q),
      recent("needs", "id, title, created_at, organizations(id, name, logo_url)", q => q.eq("status", "open")),
      recent("needs", "id, title, updated_at, organizations(id, name, logo_url)", q => q.eq("status", "fulfilled"), "updated_at"),
      recent("organizations", "id, name, province, logo_url, created_at", q => q.eq("verification_status", "approved")),
      recent("impact_stories", "id, title, reviewed_at, created_at, organizations(id, name, logo_url)", q => q.eq("status", "approved")),
      recent("gift_offerings", "id, offering_type, created_at", q => q.eq("status", "approved")),
    ])

    // A source that fails (e.g. a migration not applied yet) just contributes nothing.
    const rows = (result: { data: any[] | null; error: unknown }) => (result.error ? [] : result.data || [])
    const items: ActivityItem[] = []

    for (const d of rows(donations)) {
      const need = firstOf<any>(d.needs)
      const org = firstOf<any>(d.organizations)
      const text = d.is_platform_donation
        ? "Someone donated to support the HelpLift platform"
        : need?.category
          ? `Someone donated to ${withArticle(need.category)} need${inProvince(org?.province)}`
          : `Someone donated to an organization${inProvince(org?.province)}`
      items.push({ id: `donation-${d.id}`, type: "donation", text, at: d.reviewed_at || d.updated_at })
    }

    for (const i of rows(interests)) {
      const need = firstOf<any>(i.needs)
      if (!need?.category) continue
      const org = firstOf<any>(need.organizations)
      items.push({ id: `interest-${i.id}`, type: "interest", text: `A giver offered to help with ${withArticle(need.category)} need${inProvince(org?.province)}`, at: i.created_at })
    }

    for (const n of rows(posted)) {
      const org = firstOf<any>(n.organizations)
      items.push({ id: `posted-${n.id}`, type: "need_posted", text: `${org?.name || "A verified organization"} posted a new need: "${n.title}"`, at: n.created_at, href: `/needs?need=${n.id}`, org: orgInfo(org) })
    }

    for (const n of rows(fulfilled)) {
      const org = firstOf<any>(n.organizations)
      items.push({ id: `fulfilled-${n.id}`, type: "need_fulfilled", text: `"${n.title}" was fulfilled${org?.name ? ` for ${org.name}` : ""}`, at: n.updated_at, href: org?.id ? `/organizations/${org.id}` : undefined, org: orgInfo(org) })
    }

    for (const o of rows(organizations)) {
      items.push({ id: `org-${o.id}`, type: "organization_joined", text: `${o.name} joined HelpLift as a verified organization${inProvince(o.province)}`, at: o.created_at, href: `/organizations/${o.id}`, org: orgInfo(o) })
    }

    for (const s of rows(stories)) {
      const org = firstOf<any>(s.organizations)
      items.push({ id: `story-${s.id}`, type: "story", text: `${org?.name || "An organization"} shared an impact story: "${s.title}"`, at: s.reviewed_at || s.created_at, href: org?.id ? `/organizations/${org.id}?story=${s.id}` : undefined, org: orgInfo(org) })
    }

    for (const g of rows(gifts)) {
      const what = g.offering_type === "services" ? "a service" : g.offering_type === "financial" ? "funds" : "goods"
      items.push({ id: `gift-${g.id}`, type: "gift", text: `A giver pledged ${what} to the Gift Library`, at: g.created_at, href: "/gift-library" })
    }

    const activity = items
      .filter(item => item.at)
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      .slice(0, MAX_ITEMS)

    return NextResponse.json({ success: true, activity })
  } catch (error) {
    console.error("Public activity error:", error)
    return NextResponse.json({ success: false, activity: [] })
  }
}
