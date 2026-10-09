import type { SupabaseClient } from "@supabase/supabase-js"
import { notPastFilter } from "@/lib/expiry"

// Live-data lookups the HelpLift Assistant (app/api/assistant) can call through
// Gemini function calling. Every query runs with the CALLER's own Supabase
// session - never the service-role client - so Row Level Security decides which
// rows are visible, exactly as if the user browsed the site themselves.
//
// RLS works per row, not per column: an organization row a visitor may read
// still holds contact emails, phone numbers and banking details. So every
// select below names its columns explicitly, and only public, non-personal
// fields are ever returned - no giver names, contact details, addresses, bank
// details or individual donations. Results are also limited to what is public
// (open needs, approved offerings/stories, verified organizations) even when a
// signed-in user's session could see more, like their own drafts.

const DEFAULT_LIMIT = 5
const MAX_LIMIT = 10

type ToolArgs = Record<string, unknown>

// Gemini function declarations (OpenAPI-style schema subset).
export const ASSISTANT_TOOL_DECLARATIONS = [
  {
    name: "search_needs",
    description: "Search the currently open community needs posted by verified organizations. Use for questions like 'what needs are there in Durban', 'any education needs', 'urgent needs'.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Keywords to match in the need title or description." },
        category: { type: "string", description: "Need category, e.g. Education, Food & Nutrition, Medical & Healthcare, Shelter & Housing, Clothing, Youth & Community." },
        location: { type: "string", description: "Town, city or area to match against the need's location." },
        urgency: { type: "string", enum: ["low", "medium", "high"] },
        limit: { type: "integer", description: "Maximum results (1-10, default 5)." },
      },
    },
  },
  {
    name: "search_gift_library",
    description: "Search approved Gift Library offerings: goods, services or funds pledged by givers for organizations to claim.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Keywords to match in the offering title or description." },
        offering_type: { type: "string", enum: ["goods", "services", "financial"] },
        location: { type: "string" },
        limit: { type: "integer", description: "Maximum results (1-10, default 5)." },
      },
    },
  },
  {
    name: "search_organizations",
    description: "Search verified organizations on HelpLift by name, province or city. Returns public profile details and how many open needs each has.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Part of the organization's name." },
        province: { type: "string" },
        city: { type: "string" },
        limit: { type: "integer", description: "Maximum results (1-10, default 5)." },
      },
    },
  },
  {
    name: "get_organization",
    description: "Get one verified organization's public profile with its open needs and recent impact stories.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "The organization's name (or part of it)." },
      },
      required: ["name"],
    },
  },
  {
    name: "search_impact_stories",
    description: "Search published impact stories that organizations shared about their work.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Keywords to match in the story title or content." },
        limit: { type: "integer", description: "Maximum results (1-10, default 5)." },
      },
    },
  },
  {
    name: "list_need_categories",
    description: "List the need categories currently in use on HelpLift.",
    parameters: { type: "object", properties: {} },
  },
]

// Model-supplied text goes into PostgREST filter strings (ilike / or), where
// commas, parentheses, quotes and wildcards have meaning. Wildcards are dropped
// and the other special characters become "_" (ilike's any-single-character),
// so "St. John's" still matches but a value can only ever be a plain search term.
function term(value: unknown): string | null {
  if (typeof value !== "string") return null
  const cleaned = value.replace(/[%*]/g, " ").replace(/[,()"'\\:.]/g, "_").replace(/\s+/g, " ").trim().slice(0, 60)
  return cleaned || null
}

function limitOf(value: unknown) {
  const number = Math.round(Number(value))
  return Number.isFinite(number) && number > 0 ? Math.min(number, MAX_LIMIT) : DEFAULT_LIMIT
}

function excerpt(text: string | null | undefined, length = 280) {
  if (!text) return null
  return text.length > length ? `${text.slice(0, length).trimEnd()}…` : text
}

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

const PUBLIC_ORG_COLUMNS = "id, name, type, city, province, mission"

function publicOrganization(org: any) {
  if (!org) return null
  return { name: org.name, type: org.type, city: org.city, province: org.province, link: org.id ? `/organizations/${org.id}` : undefined }
}

async function searchNeeds(supabase: SupabaseClient, args: ToolArgs) {
  let query = supabase
    .from("needs")
    .select(`id, title, description, category, location, quantity, target_amount, due_date, urgency, status, created_at, organizations(${PUBLIC_ORG_COLUMNS}, verification_status)`)
    .in("status", ["open", "in_progress"])
    .or(notPastFilter("due_date"))
    .order("created_at", { ascending: false })
    .limit(limitOf(args.limit))

  const q = term(args.query)
  const category = term(args.category)
  const location = term(args.location)
  if (q) query = query.or(`title.ilike.%${q}%,description.ilike.%${q}%`)
  if (category) query = query.ilike("category", `%${category}%`)
  if (location) {
    // A need's own location is often just a town ("Sharpeville"), so also match
    // needs whose organization is in that city or province ("Gauteng").
    const { data: orgsThere } = await supabase
      .from("organizations")
      .select("id")
      .eq("verification_status", "approved")
      .or(`city.ilike.%${location}%,province.ilike.%${location}%`)
    const orgIds = (orgsThere || []).map((org: any) => org.id)
    query = orgIds.length > 0
      ? query.or(`location.ilike.%${location}%,organization_id.in.(${orgIds.join(",")})`)
      : query.ilike("location", `%${location}%`)
  }
  if (args.urgency === "low" || args.urgency === "medium" || args.urgency === "high") query = query.eq("urgency", args.urgency)

  const { data, error } = await query
  if (error) return { error: "Could not look up needs right now." }
  const needs = (data || [])
    .filter((need: any) => firstOf<any>(need.organizations)?.verification_status === "approved")
    .map((need: any) => ({
      title: need.title,
      description: excerpt(need.description),
      category: need.category,
      location: need.location,
      quantity: need.quantity,
      funding_goal: need.target_amount,
      due_date: need.due_date,
      urgency: need.urgency,
      status: need.status,
      organization: publicOrganization(firstOf(need.organizations)),
      link: `/needs?need=${need.id}`,
    }))
  return { count: needs.length, needs }
}

async function searchGiftLibrary(supabase: SupabaseClient, args: ToolArgs) {
  let query = supabase
    .from("gift_offerings")
    .select("id, title, offering_type, description, quantity_or_value, conditions, location, expiry_date, created_at")
    .eq("status", "approved")
    .or(notPastFilter("expiry_date"))
    .order("created_at", { ascending: false })
    .limit(limitOf(args.limit))

  const q = term(args.query)
  const location = term(args.location)
  if (q) query = query.or(`title.ilike.%${q}%,description.ilike.%${q}%`)
  if (location) query = query.ilike("location", `%${location}%`)
  if (args.offering_type === "goods" || args.offering_type === "services" || args.offering_type === "financial") {
    query = query.eq("offering_type", args.offering_type)
  }

  const { data, error } = await query
  if (error) return { error: "Could not look up the Gift Library right now." }
  const offerings = (data || []).map((gift: any) => ({
    title: gift.title,
    type: gift.offering_type,
    description: excerpt(gift.description),
    quantity_or_value: gift.quantity_or_value,
    conditions: excerpt(gift.conditions, 160),
    location: gift.location,
    available_until: gift.expiry_date,
    link: "/gift-library",
  }))
  return { count: offerings.length, offerings }
}

async function openNeedCounts(supabase: SupabaseClient, organizationIds: string[]) {
  const counts = new Map<string, number>()
  if (organizationIds.length === 0) return counts
  const { data } = await supabase.from("needs").select("organization_id").in("organization_id", organizationIds).in("status", ["open", "in_progress"]).or(notPastFilter("due_date"))
  for (const row of data || []) counts.set(row.organization_id, (counts.get(row.organization_id) || 0) + 1)
  return counts
}

async function searchOrganizations(supabase: SupabaseClient, args: ToolArgs) {
  let query = supabase
    .from("organizations")
    .select(PUBLIC_ORG_COLUMNS)
    .eq("verification_status", "approved")
    .order("name")
    .limit(limitOf(args.limit))

  const q = term(args.query)
  const province = term(args.province)
  const city = term(args.city)
  if (q) query = query.ilike("name", `%${q}%`)
  if (province) query = query.ilike("province", `%${province}%`)
  if (city) query = query.ilike("city", `%${city}%`)

  const { data, error } = await query
  if (error) return { error: "Could not look up organizations right now." }
  const counts = await openNeedCounts(supabase, (data || []).map((org: any) => org.id))
  const organizations = (data || []).map((org: any) => ({
    ...publicOrganization(org),
    mission: excerpt(org.mission, 200),
    open_needs: counts.get(org.id) || 0,
  }))
  return { count: organizations.length, organizations }
}

async function getOrganization(supabase: SupabaseClient, args: ToolArgs) {
  const name = term(args.name)
  if (!name) return { error: "An organization name is required." }

  const { data: orgs, error } = await supabase
    .from("organizations")
    .select(`${PUBLIC_ORG_COLUMNS}, created_at`)
    .eq("verification_status", "approved")
    .ilike("name", `%${name}%`)
    .limit(5)
  if (error) return { error: "Could not look up that organization right now." }
  if (!orgs || orgs.length === 0) return { found: false, message: `No verified organization matches "${name}".` }
  if (orgs.length > 1) {
    return { found: false, message: "Several organizations match - ask the user which one they mean.", matches: orgs.map(publicOrganization) }
  }

  const org: any = orgs[0]
  const [needs, stories, timeline] = await Promise.all([
    supabase.from("needs").select("id, title, category, location, urgency, due_date").eq("organization_id", org.id).in("status", ["open", "in_progress"]).or(notPastFilter("due_date")).order("created_at", { ascending: false }).limit(MAX_LIMIT),
    supabase.from("impact_stories").select("id, title, created_at").eq("organization_id", org.id).eq("status", "approved").order("created_at", { ascending: false }).limit(5),
    supabase.from("org_timeline_posts").select("id, post_type, title, body, event_starts_at, event_location, created_at").eq("organization_id", org.id).order("created_at", { ascending: false }).limit(5),
  ])

  return {
    found: true,
    organization: {
      ...publicOrganization(org),
      mission: excerpt(org.mission, 500),
      on_helplift_since: org.created_at?.slice(0, 10),
      open_needs: (needs.data || []).map((need: any) => ({ title: need.title, category: need.category, location: need.location, urgency: need.urgency, due_date: need.due_date, link: `/needs?need=${need.id}` })),
      recent_impact_stories: (stories.data || []).map((story: any) => ({ title: story.title, link: `/organizations/${org.id}?story=${story.id}` })),
      // The organization's own timeline: updates, events, milestones and news.
      latest_timeline_posts: (timeline.data || []).map((post: any) => ({
        type: post.post_type,
        title: post.title,
        text: excerpt(post.body, 300),
        posted: post.created_at?.slice(0, 10),
        ...(post.event_starts_at ? { event_date: post.event_starts_at, event_location: post.event_location } : {}),
        link: `/organizations/${org.id}#post-${post.id}`,
      })),
    },
  }
}

async function searchImpactStories(supabase: SupabaseClient, args: ToolArgs) {
  let query = supabase
    .from("impact_stories")
    .select("id, title, content, created_at, organizations(id, name, city, province)")
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .limit(limitOf(args.limit))

  const q = term(args.query)
  if (q) query = query.or(`title.ilike.%${q}%,content.ilike.%${q}%`)

  const { data, error } = await query
  if (error) return { error: "Could not look up impact stories right now." }
  const stories = (data || []).map((story: any) => {
    const org = firstOf<any>(story.organizations)
    return {
      title: story.title,
      summary: excerpt(story.content, 240),
      organization: publicOrganization(org),
      published: story.created_at?.slice(0, 10),
      link: org?.id ? `/organizations/${org.id}?story=${story.id}` : undefined,
    }
  })
  return { count: stories.length, stories }
}

async function listNeedCategories(supabase: SupabaseClient) {
  const { data, error } = await supabase.from("need_categories").select("name").eq("is_active", true).order("sort_order")
  if (error) return { error: "Could not look up categories right now." }
  return { categories: (data || []).map((row: any) => row.name) }
}

export async function runAssistantTool(supabase: SupabaseClient, name: string, args: ToolArgs): Promise<Record<string, unknown>> {
  try {
    switch (name) {
      case "search_needs": return await searchNeeds(supabase, args)
      case "search_gift_library": return await searchGiftLibrary(supabase, args)
      case "search_organizations": return await searchOrganizations(supabase, args)
      case "get_organization": return await getOrganization(supabase, args)
      case "search_impact_stories": return await searchImpactStories(supabase, args)
      case "list_need_categories": return await listNeedCategories(supabase)
      default: return { error: `Unknown tool "${name}".` }
    }
  } catch (error) {
    console.error(`Assistant tool ${name} failed:`, error)
    return { error: "That lookup failed." }
  }
}
