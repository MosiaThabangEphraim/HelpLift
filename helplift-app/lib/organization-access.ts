import type { SupabaseClient } from "@supabase/supabase-js"

// Roles inside an organization (see 20260920000100_organization_team_roles.sql).
// Higher roles include everything below them.
export type OrgRole = "owner" | "manager" | "viewer"

export const ORG_ROLES: OrgRole[] = ["owner", "manager", "viewer"]
// Every role can be assigned: an organization may have several owners.
export const INVITABLE_ROLES: OrgRole[] = ["owner", "manager", "viewer"]

const RANK: Record<OrgRole, number> = { owner: 3, manager: 2, viewer: 1 }

export function roleAtLeast(role: OrgRole | null | undefined, min: OrgRole) {
  return !!role && RANK[role] >= RANK[min]
}

export const ROLE_LABELS: Record<OrgRole, string> = {
  owner: "Owner",
  manager: "Manager",
  viewer: "Viewer",
}

export type OrgContext<T = Record<string, any>> = { organization: T; role: OrgRole }

// Resolves the signed-in user's organization through organization_members,
// so owners, managers and viewers all work. `columns` is the organizations
// column list to select (defaults to just the id).
export async function getOrgContext<T = { id: string }>(
  supabase: SupabaseClient,
  userId: string,
  columns = "id"
): Promise<OrgContext<T> | null> {
  const { data } = await supabase
    .from("organization_members")
    .select(`role, organizations(${columns})`)
    .eq("profile_id", userId)
    .maybeSingle()
  if (!data) return null
  const org = Array.isArray((data as any).organizations) ? (data as any).organizations[0] : (data as any).organizations
  if (!org) return null
  return { organization: org as T, role: (data as any).role as OrgRole }
}

// Standard message when a role isn't high enough for an action.
export function insufficientRoleMessage(role: OrgRole, min: OrgRole) {
  return `Your ${ROLE_LABELS[role].toLowerCase()} access doesn't allow this. ${ROLE_LABELS[min]} access or higher is required.`
}
