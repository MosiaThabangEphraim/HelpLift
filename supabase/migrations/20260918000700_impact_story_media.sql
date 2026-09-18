-- Migration: 20260918000700_impact_story_media.sql
-- Description: Impact stories were limited to one photo OR one video
-- (image_url / video_url columns). Adds an impact_story_media child table so
-- an organization can attach multiple photos and videos to a single story,
-- following the same child-table + SECURITY DEFINER insert function pattern
-- as fulfillment_proofs / donation_proofs / notification_attachments (a
-- plain RLS INSERT policy on this shape of row has previously hit a
-- reproducible, unexplained rejection in this project — see the
-- send_notification comment in 20260914002700).
--
-- impact_stories.image_url / video_url are left in place and still get set
-- to the FIRST photo / FIRST video of a story, so the existing single-media
-- display on the public homepage carousel keeps working unchanged; the
-- dashboard and the organization's public profile page read the full list
-- from this table instead.

create table if not exists public.impact_story_media (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.impact_stories(id) on delete cascade,
  media_type text not null check (media_type in ('image', 'video')),
  url text not null,
  storage_path text,
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists impact_story_media_story_id_idx on public.impact_story_media(story_id);

alter table public.impact_story_media enable row level security;

-- Public content, same as "Anyone can view impact stories" on the parent table.
drop policy if exists "Anyone can view impact story media" on public.impact_story_media;
create policy "Anyone can view impact story media"
on public.impact_story_media for select
using (true);

drop policy if exists "Organizations can delete their impact story media" on public.impact_story_media;
create policy "Organizations can delete their impact story media"
on public.impact_story_media for delete to authenticated
using (
  exists (
    select 1 from public.impact_stories s
    join public.organizations o on o.id = s.organization_id
    where s.id = story_id and o.profile_id = (select auth.uid())
  )
);

drop policy if exists "Admins can manage impact story media" on public.impact_story_media;
create policy "Admins can manage impact story media"
on public.impact_story_media for all to authenticated
using (public.is_admin());

create or replace function public.add_impact_story_media(p_story_id uuid, p_media_type text, p_url text, p_storage_path text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_new_id uuid;
  v_position int;
begin
  if v_uid is null then
    raise exception 'Authentication required.';
  end if;

  if p_media_type not in ('image', 'video') then
    raise exception 'Invalid media type.';
  end if;

  if not exists (
    select 1 from public.impact_stories s
    join public.organizations o on o.id = s.organization_id
    where s.id = p_story_id and o.profile_id = v_uid
  ) then
    raise exception 'You are not permitted to add media to this story.';
  end if;

  select coalesce(max(position), -1) + 1 into v_position from public.impact_story_media where story_id = p_story_id;

  insert into public.impact_story_media (story_id, media_type, url, storage_path, position)
  values (p_story_id, p_media_type, p_url, p_storage_path, v_position)
  returning id into v_new_id;

  return v_new_id;
end;
$$;
grant execute on function public.add_impact_story_media(uuid, text, text, text) to authenticated;
