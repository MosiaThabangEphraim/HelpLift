-- Migration: 20260930000400_login_lockout.sql
-- Description: Locks an account after 5 consecutive failed password
-- attempts (see api/login), until the person verifies a one-time code
-- emailed to them (see the new api/login/unlock and
-- api/login/unlock/resend routes). Adds profiles.failed_login_attempts /
-- profiles.locked_until, and a small table to hold the (hashed) unlock
-- codes - there's no existing OTP/code table to reuse, since email
-- verification and password reset both go through Supabase Auth's own
-- built-in flows (verifyOtp / resetPasswordForEmail), not a custom one.

alter table public.profiles add column if not exists failed_login_attempts integer not null default 0;
alter table public.profiles add column if not exists locked_until timestamptz;

create table if not exists public.login_lockout_codes (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  code_hash text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists login_lockout_codes_profile_id_idx on public.login_lockout_codes(profile_id);

-- Only ever read/written by server routes using the service-role client -
-- there's no signed-in session mid-login-attempt to scope a normal RLS
-- policy to. Enabling RLS with no policies denies anon/authenticated
-- entirely; the service role bypasses RLS as usual.
alter table public.login_lockout_codes enable row level security;

-- failed_login_attempts/locked_until are written by api/login and
-- api/login/unlock using the service-role client (no user session exists
-- mid-login-attempt), so the existing privilege-escalation trigger needs
-- the same service_role allowance already given to prevent_donation_tamper()
-- in 20260926000500_donation_tamper_service_role.sql for the identical
-- reason - otherwise a locked-out user could simply clear their own lockout
-- with a direct client-side profiles update (these columns aren't covered
-- by any column-level RLS restriction on their own), AND the legitimate
-- service-role lockout write would itself get blocked as a "non-admin"
-- change, since auth.uid() is null for a service-role connection.
create or replace function public.prevent_profile_privilege_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() or auth.role() = 'service_role' then
    return new;
  end if;
  if new.role <> old.role
    or new.suspended <> old.suspended
    or coalesce(new.suspended_reason, '') <> coalesce(old.suspended_reason, '')
    or new.suspended_at is distinct from old.suspended_at
    or new.failed_login_attempts <> old.failed_login_attempts
    or new.locked_until is distinct from old.locked_until
  then
    raise exception 'You may not change your own role, suspension status, or lockout state.';
  end if;
  return new;
end;
$$;
