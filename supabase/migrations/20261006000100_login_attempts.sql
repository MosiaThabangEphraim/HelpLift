-- Login activity log for the admin Security tab: every sign-in attempt,
-- successful or not, across every method (password, Google, Microsoft,
-- LinkedIn, passkey) and both portals (user and admin), plus the steps around
-- it (two-factor codes, lockouts, unlocks).
--
-- Rows are written only by the server with the service role (see
-- lib/login-audit.ts) - there is deliberately no insert policy, so nobody can
-- forge entries from the browser. Only administrators can read them.
-- Entries older than 90 days are deleted by the admin API whenever the
-- Security tab loads (app/api/admin/login-attempts), so the log never grows
-- without bound and no scheduled job is needed.

create table if not exists public.login_attempts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  -- What was typed (or the provider's email); kept even when it matches no account.
  email text,
  -- The matching account, when there is one.
  profile_id uuid references public.profiles(id) on delete set null,
  outcome text not null check (outcome in (
    'success',
    'wrong_password',
    'unknown_account',
    'locked',
    'account_locked_now',
    'two_factor_sent',
    'two_factor_passed',
    'two_factor_failed',
    'unlocked',
    'unlock_failed',
    'wrong_portal',
    'error'
  )),
  method text not null default 'password' check (method in ('password', 'google', 'microsoft', 'linkedin', 'passkey', 'other')),
  portal text not null default 'user' check (portal in ('user', 'admin')),
  ip_address text,
  country text,
  city text,
  user_agent text,
  device text,
  detail text
);

create index if not exists login_attempts_created_at_idx on public.login_attempts(created_at desc);
create index if not exists login_attempts_profile_idx on public.login_attempts(profile_id, created_at desc);
create index if not exists login_attempts_ip_idx on public.login_attempts(ip_address, created_at desc);
create index if not exists login_attempts_outcome_idx on public.login_attempts(outcome, created_at desc);

alter table public.login_attempts enable row level security;

drop policy if exists "Admins can view login attempts" on public.login_attempts;
create policy "Admins can view login attempts"
on public.login_attempts for select to authenticated
using (public.is_admin());
