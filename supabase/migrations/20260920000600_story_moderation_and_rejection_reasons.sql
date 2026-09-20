-- Migration: 20260920000600_story_moderation_and_rejection_reasons.sql
-- Description:
--   1. Impact stories now go through admin approval before they're public.
--      New stories start 'pending'; an administrator approves or rejects them
--      (with an optional reason that is sent to the organization). Stories that
--      already exist stay visible (they're back-filled as 'approved').
--   2. Editing a story, or adding/removing its photos or videos, sends it back
--      to 'pending', so approved content can't be swapped for something else.
--   3. Gift offerings get a rejection_reason, so the giver is told why a
--      listing was rejected.

-- --- 1. Story status ------------------------------------------------------

alter table public.impact_stories add column if not exists status text not null default 'approved';
alter table public.impact_stories alter column status set default 'pending';
alter table public.impact_stories drop constraint if exists impact_stories_status_check;
alter table public.impact_stories add constraint impact_stories_status_check
  check (status in ('pending', 'approved', 'rejected'));
alter table public.impact_stories add column if not exists rejection_reason text;
alter table public.impact_stories add column if not exists reviewed_by uuid references public.profiles(id) on delete set null;
alter table public.impact_stories add column if not exists reviewed_at timestamptz;

-- Public can only see approved stories; an organization's team can also see
-- their own (to track status / read the rejection reason). Admins already have
-- "Admins can manage impact stories".
drop policy if exists "Anyone can view impact stories" on public.impact_stories;
drop policy if exists "Anyone can view approved impact stories" on public.impact_stories;
create policy "Anyone can view approved impact stories"
on public.impact_stories for select
using (status = 'approved');

drop policy if exists "Members can view their impact stories" on public.impact_stories;
create policy "Members can view their impact stories"
on public.impact_stories for select to authenticated
using (public.has_org_role(organization_id, 'viewer'));

-- Same rule for the story's photos/videos.
drop policy if exists "Anyone can view impact story media" on public.impact_story_media;
drop policy if exists "View impact story media of visible stories" on public.impact_story_media;
create policy "View impact story media of visible stories"
on public.impact_story_media for select
using (exists (
  select 1 from public.impact_stories s
  where s.id = story_id
    and (s.status = 'approved' or public.has_org_role(s.organization_id, 'viewer') or public.is_admin())
));

-- Moderation guard: only admins decide a story's status.
create or replace function public.guard_impact_story_moderation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() then
    if tg_op = 'UPDATE' and new.status is distinct from old.status and new.status in ('approved', 'rejected') then
      new.reviewed_by := auth.uid();
      new.reviewed_at := now();
      if new.status = 'approved' then
        new.rejection_reason := null;
      end if;
    end if;
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.status := 'pending';
    new.rejection_reason := null;
    new.reviewed_by := null;
    new.reviewed_at := null;
    return new;
  end if;

  -- An organization editing its story: moderation fields can't be touched, and
  -- the edited story goes back for review.
  new.reviewed_by := old.reviewed_by;
  new.reviewed_at := old.reviewed_at;
  new.status := 'pending';
  new.rejection_reason := null;
  return new;
end;
$$;

drop trigger if exists impact_stories_guard_moderation on public.impact_stories;
create trigger impact_stories_guard_moderation
before insert or update on public.impact_stories
for each row execute function public.guard_impact_story_moderation();

-- Adding or removing a story's media by anyone but an admin sends it back to review.
create or replace function public.impact_story_media_resubmit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_story uuid := coalesce(new.story_id, old.story_id);
begin
  if not public.is_admin() then
    update public.impact_stories set status = 'pending' where id = v_story and status <> 'pending';
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists impact_story_media_resubmit on public.impact_story_media;
create trigger impact_story_media_resubmit
after insert or delete on public.impact_story_media
for each row execute function public.impact_story_media_resubmit();

-- --- 3. Gift listing rejection reason -------------------------------------

alter table public.gift_offerings add column if not exists rejection_reason text;
