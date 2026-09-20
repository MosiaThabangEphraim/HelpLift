import { createHash, randomBytes } from "crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { OrgRole } from "@/lib/organization-access"

export const INVITE_TTL_DAYS = 7

// Tokens are random 256-bit values; only their SHA-256 hash is stored, so a
// database leak can't be turned into working invite links.
export function generateInviteToken() {
  const token = randomBytes(32).toString("hex")
  return { token, tokenHash: hashInviteToken(token) }
}

export function hashInviteToken(token: string) {
  return createHash("sha256").update(token).digest("hex")
}

export type InviteStatus = "valid" | "expired" | "revoked" | "accepted"

export type InviteLookup = {
  id: string
  organization_id: string
  organization_name: string
  email: string
  role: OrgRole
  status: InviteStatus
}

// Looks up an invitation by its raw token. Needs a service-role client:
// invitations have no RLS policies, so they are never readable from the browser.
export async function lookupInvitation(admin: SupabaseClient, token: string): Promise<InviteLookup | null> {
  if (!/^[a-f0-9]{64}$/.test(token)) return null
  const { data } = await admin
    .from("organization_invitations")
    .select("id, organization_id, email, role, expires_at, accepted_at, revoked_at, organizations(name)")
    .eq("token_hash", hashInviteToken(token))
    .maybeSingle()
  if (!data) return null

  const orgField = (data as any).organizations
  const org = Array.isArray(orgField) ? orgField[0] : orgField
  let status: InviteStatus = "valid"
  if (data.accepted_at) status = "accepted"
  else if (data.revoked_at) status = "revoked"
  else if (new Date(data.expires_at).getTime() < Date.now()) status = "expired"

  return {
    id: data.id,
    organization_id: data.organization_id,
    organization_name: org?.name || "an organization",
    email: data.email,
    role: data.role as OrgRole,
    status,
  }
}
