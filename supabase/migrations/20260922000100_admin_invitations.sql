-- Email invitations for new administrators, mirroring
-- organization_invitations (20260920000100_organization_team_roles.sql):
-- token stored hashed, no RLS policies at all (service-role only - enforced
-- by the admin-only API routes, exactly like the organization invite table).

create table if not exists public.admin_invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  token_hash text not null unique,
  invited_by uuid references public.profiles(id) on delete set null,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists admin_invitations_email_idx on public.admin_invitations(email);

alter table public.admin_invitations enable row level security;
-- Intentionally no policies: only the service-role client (used by
-- /api/admin/invitations/**, after an admin-role check) ever touches this table.
