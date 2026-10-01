-- Migration: 20260930000600_two_factor_login.sql
-- Description: Email-based two-factor sign-in. After a correct password,
-- if the account has it enabled, a 6-digit code is emailed and the session
-- Supabase just created is torn down immediately - no usable session exists
-- until api/login/verify-2fa confirms the code. Default is enabled, with a
-- Settings toggle to turn it off (see api/account's PATCH).
--
-- two_factor_codes is keyed by an opaque attempt_token (returned only to
-- whoever just supplied the correct password), not by email - verifying a
-- code also requires that token, so knowing someone's email alone (e.g.
-- resend-spamming their inbox) never lets anyone reach a session. This is
-- a different shape from login_lockout_codes (20260930000400), which is
-- intentionally keyed by email alone since there's no earlier verified
-- step to tie it to.

alter table public.profiles add column if not exists two_factor_enabled boolean not null default true;

create table if not exists public.two_factor_codes (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  attempt_token text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists two_factor_codes_attempt_token_idx on public.two_factor_codes(attempt_token);
create index if not exists two_factor_codes_profile_id_idx on public.two_factor_codes(profile_id);

-- Only ever read/written by server routes using the service-role client -
-- there's no signed-in session mid-login-attempt to scope a normal RLS
-- policy to. Enabling RLS with no policies denies anon/authenticated
-- entirely; the service role bypasses RLS as usual.
alter table public.two_factor_codes enable row level security;

-- Unlike failed_login_attempts/locked_until, two_factor_enabled is meant to
-- be self-editable (that's the feature - a Settings toggle), so it does NOT
-- need adding to prevent_profile_privilege_escalation()'s guarded-column
-- list; the existing "users can update their own profile" policy already
-- covers it correctly.
