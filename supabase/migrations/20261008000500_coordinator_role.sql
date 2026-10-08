-- Migration: 20261008000500_coordinator_role.sql
-- Description: The organization "viewer" role becomes "coordinator": the
-- team member who does the day-to-day work with givers, instead of a
-- read-only seat.
--
--   owner       - everything, including banking, withdrawals, documents and the team
--   manager     - needs, offers, Gift Library claims and impact stories; sees
--                 donations and the wallet
--   coordinator - deliveries (update fulfillments, upload proof), messages
--                 (givers the organization works with, administrators,
--                 replies) and impact stories (create and edit; an admin
--                 still approves them). No needs, offers, claims, documents,
--                 team or money.
--
-- The enum value is renamed in place, so policies that compared against
-- 'viewer' now compare against 'coordinator' with no other change. Functions
-- whose bodies spelled out 'viewer' are recreated below, and the policies and
-- functions Coordinators now pass (or no longer pass) are rewritten.
-- No organization uses team roles yet, so no existing members are affected.

-- --- 1. Rename the role ------------------------------------------------------
do $$
begin
  if exists (
    select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
    where t.typname = 'org_member_role' and e.enumlabel = 'viewer'
  ) then
    alter type public.org_member_role rename value 'viewer' to 'coordinator';
  end if;
end;
$$;

-- --- 2. Functions that named the old role ---------------------------------

create or replace function public.org_member_can_see_giver(p_giver uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.support_interests si
    join public.needs n on n.id = si.need_id
    where si.giver_id = p_giver and public.has_org_role(n.organization_id, 'coordinator')
  ) or exists (
    select 1 from public.donations d
    where d.giver_id = p_giver and d.organization_id is not null
      and public.has_org_role(d.organization_id, 'coordinator')
  ) or exists (
    select 1 from public.fulfillments f
    where f.giver_id = p_giver and public.has_org_role(f.organization_id, 'coordinator')
  );
$$;
grant execute on function public.org_member_can_see_giver(uuid) to authenticated;

-- Messaging: Coordinators may now message administrators, givers the
-- organization works with, and reply to anyone who messaged them. Messaging
-- another organization stays with owners and managers. Everything else is
-- identical to 20260920001200_replies_always_allowed.sql.
create or replace function public.send_notification(
  p_recipient uuid,
  p_type text,
  p_title text,
  p_message text,
  p_attachment_storage_path text default null,
  p_attachment_file_name text default null,
  p_reply_to uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sender uuid := auth.uid();
  v_sender_name text;
  v_sender_role text;
  v_recipient_role text;
  v_new_id uuid;
  v_allowed boolean := false;
  v_orig record;
  v_snippet text;
begin
  if v_sender is null then
    raise exception 'Authentication required.';
  end if;

  -- A reply must answer a message the sender actually received, and goes back
  -- to whoever sent it.
  if p_reply_to is not null then
    select n.recipient_id, n.sender_id, n.message
      into v_orig
      from public.notifications n
     where n.id = p_reply_to;
    if not found or v_orig.recipient_id is distinct from v_sender then
      raise exception 'You can only reply to a message you received.';
    end if;
    if v_orig.sender_id is distinct from p_recipient then
      raise exception 'A reply must go to the person who sent the original message.';
    end if;
    v_snippet := left(regexp_replace(v_orig.message, '\s+', ' ', 'g'), 240);
  end if;

  select full_name, role into v_sender_name, v_sender_role from public.profiles where id = v_sender;
  select role into v_recipient_role from public.profiles where id = p_recipient;

  if v_recipient_role is null then
    raise exception 'Recipient not found.';
  end if;

  if public.is_suspended() and v_recipient_role <> 'admin' then
    raise exception 'Your account is suspended. You may only message an administrator.';
  end if;

  -- Admins may message anyone; anyone may message an admin.
  if v_sender_role = 'admin' or v_recipient_role = 'admin' then
    v_allowed := true;
  end if;

  -- A giver may message any organization.
  if not v_allowed and v_sender_role = 'giver' and v_recipient_role = 'organization' then
    v_allowed := true;
  end if;

  -- Any organization team member (coordinator and up) may message a giver the
  -- organization has an existing relationship with.
  if not v_allowed and v_sender_role = 'organization' and v_recipient_role = 'giver' then
    v_allowed := exists (
      select 1
      from public.support_interests si
      join public.needs n on n.id = si.need_id
      join public.givers g on g.id = si.giver_id
      where g.profile_id = p_recipient and public.has_org_role(n.organization_id, 'coordinator')
    ) or exists (
      select 1
      from public.donations d
      join public.givers g on g.id = d.giver_id
      where g.profile_id = p_recipient
        and d.organization_id is not null
        and public.has_org_role(d.organization_id, 'coordinator')
    ) or exists (
      select 1
      from public.fulfillments f
      join public.givers g on g.id = f.giver_id
      where g.profile_id = p_recipient and public.has_org_role(f.organization_id, 'coordinator')
    );
  end if;

  -- An organization owner or manager may message another organization.
  if not v_allowed and v_sender_role = 'organization' and v_recipient_role = 'organization' then
    v_allowed := p_recipient <> v_sender and exists (
      select 1 from public.organization_members m
      where m.profile_id = v_sender and m.role in ('owner', 'manager')
    );
  end if;

  -- A valid reply (checked above) is always allowed: the other person started
  -- the conversation.
  if not v_allowed and p_reply_to is not null then
    v_allowed := true;
  end if;

  if not v_allowed then
    raise exception 'You are not permitted to message this recipient.';
  end if;

  insert into public.notifications (
    recipient_id, sender_id, sender_name, sender_role, type, title, message,
    attachment_storage_path, attachment_file_name, reply_to_id, reply_to_snippet
  )
  values (
    p_recipient, v_sender, v_sender_name, v_sender_role, p_type, p_title, p_message,
    p_attachment_storage_path, p_attachment_file_name, p_reply_to, v_snippet
  )
  returning id into v_new_id;

  return v_new_id;
end;
$$;
grant execute on function public.send_notification(uuid, text, text, text, text, text, uuid) to authenticated;

-- --- 3. Deliveries: Coordinators update fulfillments and add proof --------

drop policy if exists "Managers can update fulfillments" on public.fulfillments;
drop policy if exists "Coordinators can update fulfillments" on public.fulfillments;
create policy "Coordinators can update fulfillments"
on public.fulfillments for update to authenticated
using (public.has_org_role(organization_id, 'coordinator'))
with check (public.has_org_role(organization_id, 'coordinator'));

create or replace function public.add_fulfillment_proof(p_fulfillment_id uuid, p_storage_path text, p_file_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_new_id uuid;
begin
  if v_uid is null then
    raise exception 'Authentication required.';
  end if;

  if not exists (
    select 1 from public.fulfillments f
    where f.id = p_fulfillment_id and public.has_org_role(f.organization_id, 'coordinator')
  ) then
    raise exception 'You are not permitted to add proof to this fulfillment.';
  end if;

  insert into public.fulfillment_proofs (fulfillment_id, storage_path, file_name, uploaded_by)
  values (p_fulfillment_id, p_storage_path, p_file_name, v_uid)
  returning id into v_new_id;

  return v_new_id;
end;
$$;
grant execute on function public.add_fulfillment_proof(uuid, text, text) to authenticated;

-- --- 4. Impact stories: Coordinators create and edit (admins still approve) -
-- Deleting a story stays with managers and owners.

drop policy if exists "Managers can create impact stories" on public.impact_stories;
drop policy if exists "Coordinators can create impact stories" on public.impact_stories;
create policy "Coordinators can create impact stories"
on public.impact_stories for insert to authenticated
with check (public.has_org_role(organization_id, 'coordinator'));

drop policy if exists "Managers can update impact stories" on public.impact_stories;
drop policy if exists "Coordinators can update impact stories" on public.impact_stories;
create policy "Coordinators can update impact stories"
on public.impact_stories for update to authenticated
using (public.has_org_role(organization_id, 'coordinator'));

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
    where s.id = p_story_id and public.has_org_role(s.organization_id, 'coordinator')
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

-- --- 5. Money: donations and withdrawals are for managers and owners only --

drop policy if exists "Members can view donations to their organization" on public.donations;
drop policy if exists "Managers can view donations to their organization" on public.donations;
create policy "Managers can view donations to their organization"
on public.donations for select to authenticated
using (organization_id is not null and public.has_org_role(organization_id, 'manager'));

drop policy if exists "Org members can view their withdrawals" on public.organization_withdrawals;
drop policy if exists "Managers can view their withdrawals" on public.organization_withdrawals;
create policy "Managers can view their withdrawals"
on public.organization_withdrawals for select to authenticated
using (public.has_org_role(organization_id, 'manager') or public.is_admin());

-- --- 6. Safety check: nothing left that still names the old role ---------
do $$
declare
  leftover text;
begin
  select string_agg(p.proname, ', ') into leftover
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prosrc ilike '%''viewer''%';
  if leftover is not null then
    raise warning 'These functions still mention the old viewer role: %', leftover;
  end if;
end;
$$;
