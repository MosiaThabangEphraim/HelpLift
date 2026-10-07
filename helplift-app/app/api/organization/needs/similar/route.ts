import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getOrgContext } from "@/lib/organization-access"
import { needSimilarity, SIMILARITY_THRESHOLD, tokenize } from "@/lib/need-similarity"

// Looks for needs that resemble the one an organization is drafting: its own
// needs (any status except rejected/closed) and other organizations' public
// (open / in progress) needs. Advisory only; it never blocks posting.
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ message: "Authentication required." }, { status: 401 })
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
    if (profile?.role !== "organization") return NextResponse.json({ message: "Organization access required." }, { status: 403 })
    const ctx = await getOrgContext<{ id: string }>(supabase, user.id, "id")
    if (!ctx?.organization) return NextResponse.json({ message: "Organization not found." }, { status: 404 })

    const { searchParams } = new URL(request.url)
    const draft = {
      title: searchParams.get("title") || "",
      description: searchParams.get("description") || "",
      category: searchParams.get("category") || "",
      location: searchParams.get("location") || "",
    }
    const excludeId = searchParams.get("exclude") || ""
    if (tokenize(draft.title).size === 0) return NextResponse.json({ similar: [] })

    const orgId = ctx.organization.id
    const columns = "id, title, description, category, location, status, organization_id, created_at, organizations(name)"
    const [mine, others] = await Promise.all([
      supabase.from("needs").select(columns).eq("organization_id", orgId).in("status", ["draft", "open", "in_progress", "fulfilled"]).order("created_at", { ascending: false }).limit(300),
      supabase.from("needs").select(columns).neq("organization_id", orgId).in("status", ["open", "in_progress"]).order("created_at", { ascending: false }).limit(500),
    ])

    const candidates = [...(mine.data || []), ...(others.data || [])] as any[]
    const similar = candidates
      .filter(item => item.id !== excludeId)
      .map(item => ({ item, score: needSimilarity(draft, item) }))
      .filter(entry => entry.score >= SIMILARITY_THRESHOLD)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
      .map(({ item, score }) => ({
        id: item.id,
        title: item.title,
        category: item.category,
        location: item.location,
        status: item.status,
        own: item.organization_id === orgId,
        organization_name: item.organization_id === orgId ? null : (Array.isArray(item.organizations) ? item.organizations[0]?.name : item.organizations?.name) ?? null,
        score: Math.round(score * 100),
      }))

    return NextResponse.json({ similar })
  } catch (error) {
    console.error("Similar needs error:", error)
    return NextResponse.json({ similar: [] })
  }
}
