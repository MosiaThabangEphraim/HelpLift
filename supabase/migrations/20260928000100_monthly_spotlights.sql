-- Migration: 20260928000100_monthly_spotlights.sql
-- Description: "Giver of the Month" / "Organization of the Month" - shown
-- on the homepage next to Impact Stories. Unlike badges (lib/badges.ts),
-- which are recomputed fresh every time because they're personal, ever-
-- growing achievements, a monthly spotlight is a ranking against everyone
-- else for one specific, already-closed period - September's winner has to
-- stay September's winner forever, even after October's activity starts
-- coming in. So this is a real snapshot table, finalized once per period,
-- the first time anyone asks for it after that month has ended (see
-- lib/spotlights.ts) - no cron job needed, same "compute lazily on first
-- read after rollover" approach used elsewhere in this project.
--
-- Only ever written by server code (the public spotlights route finalizing
-- a just-completed month, or the admin override route) using the
-- service-role client - same trust pattern as badge_awards. No RLS policy
-- is added for authenticated/anon roles; reads for the public homepage and
-- the admin override screen both go through dedicated API routes instead.

create table if not exists public.monthly_spotlights (
  id uuid primary key default gen_random_uuid(),
  period text not null, -- 'YYYY-MM' - the (already-completed) month this is for
  subject_type text not null check (subject_type in ('giver', 'organization')),
  subject_id uuid not null,
  metric_value numeric not null default 0,
  is_admin_override boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- At most one winner per category per period - an admin override replaces
-- the row rather than adding a second one.
create unique index if not exists monthly_spotlights_period_type_unique on public.monthly_spotlights(period, subject_type);

alter table public.monthly_spotlights enable row level security;
