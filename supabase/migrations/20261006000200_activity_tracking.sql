-- Live system activity for the admin "Live activity" tab: what signed-in
-- users are doing - pages they open and key actions (posting a need,
-- donating, pledging, messaging...). Only signed-in users are tracked;
-- signed-out visitors stay anonymous (see site_visits for those counts).
--
-- What is NOT stored: message text, form contents, passwords, payment or
-- banking details - only that an action happened, and on which page.
--
-- activity_events is the history; user_presence holds one row per user with
-- when they were last active and where, for "online now". Both are written
-- only by the server with the service role (app/api/activity and
-- lib/activity-log.ts), never directly from the browser, and only
-- administrators can read them. Events older than 90 days are deleted by the
-- admin API whenever the Live activity tab loads.
--
-- Disclosed in the Privacy Policy (app/privacy) as required by POPIA.

create table if not exists public.activity_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role text,
  kind text not null check (kind in ('page_view', 'action')),
  -- For actions: a short label, e.g. "Posted a need". For page views: null.
  action text,
  path text,
  detail text
);

create index if not exists activity_events_created_at_idx on public.activity_events(created_at desc);
create index if not exists activity_events_profile_idx on public.activity_events(profile_id, created_at desc);

alter table public.activity_events enable row level security;

drop policy if exists "Admins can view activity events" on public.activity_events;
create policy "Admins can view activity events"
on public.activity_events for select to authenticated
using (public.is_admin());

create table if not exists public.user_presence (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  last_seen_at timestamptz not null default now(),
  path text
);

create index if not exists user_presence_last_seen_idx on public.user_presence(last_seen_at desc);

alter table public.user_presence enable row level security;

drop policy if exists "Admins can view user presence" on public.user_presence;
create policy "Admins can view user presence"
on public.user_presence for select to authenticated
using (public.is_admin());
