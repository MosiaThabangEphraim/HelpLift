-- Migration: 20260914001600_messaging_and_helpers.sql
-- Description: Adds direct messaging (admin <-> user/org, organization -> interested giver)
-- and fixes a pre-existing RLS gap where organizations could never actually see the
-- name/email of a giver who expressed interest in one of their needs.

-- 1. Track who sent a notification (nullable — system-generated notifications, e.g.
-- organization verification updates, have no human sender).
alter table public.notifications add column if not exists sender_id uuid references public.profiles(id) on delete set null;

-- 2. Bug fix: api/organization/interests's `givers(name, email)` embed has always
-- returned null because no policy ever granted organizations SELECT access to a
-- giver's row — only the giver themselves (or an admin) could read it. The
-- "Giver interests" section has been silently showing "Giver" / blank email ever
-- since. This also gives organizations the visibility they need to target a
-- message at a specific interested giver (below).
drop policy if exists "Organizations can view interested givers" on public.givers;
create policy "Organizations can view interested givers"
on public.givers for select to authenticated
using (
  exists (
    select 1
    from public.support_interests si
    join public.needs n on n.id = si.need_id
    join public.organizations o on o.id = n.organization_id
    where si.giver_id = givers.id
      and o.profile_id = (select auth.uid())
  )
);

-- 3. A non-admin (giver/organization) has no way to discover an admin's profile id
-- to address a message to — profiles RLS only lets them see their own row. This
-- security-definer helper returns one admin id, bypassing that restriction; it
-- exposes nothing beyond "an admin account exists with this id".
create or replace function public.get_any_admin_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select id from public.profiles where role = 'admin' order by created_at asc limit 1;
$$;
grant execute on function public.get_any_admin_id() to authenticated;

-- 4. Security-definer check so the notifications INSERT policy below can verify
-- "is this recipient an admin?" regardless of the sender's own (restricted)
-- visibility into public.profiles.
create or replace function public.is_admin_profile(target uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from public.profiles where id = target and role = 'admin');
$$;

-- 5. Messaging RLS: any authenticated user may message an admin...
drop policy if exists "Users can send messages to admins" on public.notifications;
create policy "Users can send messages to admins"
on public.notifications for insert to authenticated
with check (public.is_admin_profile(recipient_id));

-- ...and an organization may message a giver who has expressed interest in one
-- of that organization's needs (mirrors the visibility granted in #2 above, so
-- no additional security-definer helper is needed here).
drop policy if exists "Organizations can message interested givers" on public.notifications;
create policy "Organizations can message interested givers"
on public.notifications for insert to authenticated
with check (
  exists (
    select 1
    from public.support_interests si
    join public.needs n on n.id = si.need_id
    join public.organizations o on o.id = n.organization_id
    join public.givers g on g.id = si.giver_id
    where o.profile_id = (select auth.uid())
      and g.profile_id = recipient_id
  )
);

-- ("Admins can create notifications" — i.e. admin messaging any user/org —
-- already exists from 20260914000900_notifications.sql and needs no change.)

-- 6. Admins could previously only mark their OWN notifications as read (the
-- "Users can update their notifications" policy is scoped to recipient_id =
-- auth.uid()). A "message to admin" is addressed to whichever single admin
-- get_any_admin_id() picked, so a *different* admin viewing it in their inbox
-- couldn't mark it read. Let any admin update any notification.
drop policy if exists "Admins can update notifications" on public.notifications;
create policy "Admins can update notifications"
on public.notifications for update to authenticated
using (public.is_admin())
with check (public.is_admin());
