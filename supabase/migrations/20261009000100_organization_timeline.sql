-- Migration: 20261009000100_organization_timeline.sql
-- Description: Every organization gets a public timeline: updates, events,
-- milestones and news it posts itself, with images and documents attached.
-- No admin approval - the organization controls it - and everyone can read
-- the timeline of a verified organization (public profile, directory, Lifty).
--
-- Who can do what (enforced in app/api/organization/timeline):
--   coordinator and up - post, and edit or delete their own posts
--   manager and up     - edit, delete or pin any of the organization's posts
--   administrators     - delete any post (moderation)
-- All writes go through those API routes with the service role, after the
-- role checks, so there are no insert/update/delete policies here.

create table if not exists public.org_timeline_posts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  -- Snapshot of the author's name, kept if their account is later removed.
  author_name text,
  post_type text not null default 'update' check (post_type in ('update', 'event', 'milestone', 'news')),
  title text,
  body text not null,
  -- Events only.
  event_starts_at timestamptz,
  event_location text,
  -- [{ path, name, type, size }] in the public org-timeline bucket.
  attachments jsonb not null default '[]'::jsonb,
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  edited_at timestamptz
);

create index if not exists org_timeline_posts_org_idx on public.org_timeline_posts(organization_id, pinned desc, created_at desc);
create index if not exists org_timeline_posts_created_idx on public.org_timeline_posts(created_at desc);

alter table public.org_timeline_posts enable row level security;

-- The read policy below is also checked for visitors who aren't signed in.
grant execute on function public.has_org_role(uuid, public.org_member_role) to anon;
grant execute on function public.is_admin() to anon;

-- Anyone (signed in or not) can read a verified organization's timeline; its
-- own team and administrators can always read it.
drop policy if exists "Anyone can view verified organization timelines" on public.org_timeline_posts;
create policy "Anyone can view verified organization timelines"
on public.org_timeline_posts for select to anon, authenticated
using (
  exists (select 1 from public.organizations o where o.id = organization_id and o.verification_status = 'approved')
  or public.has_org_role(organization_id, 'coordinator')
  or public.is_admin()
);

-- Public bucket for attachments (the posts themselves are public). Uploads
-- happen on the server with the service role after the role checks.
insert into storage.buckets (id, name, public, file_size_limit)
values ('org-timeline', 'org-timeline', true, 10485760)
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit;

drop policy if exists "Public can view organization timeline files" on storage.objects;
create policy "Public can view organization timeline files"
on storage.objects for select
using (bucket_id = 'org-timeline');
