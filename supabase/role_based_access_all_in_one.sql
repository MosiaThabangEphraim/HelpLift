
-- ======================================================================
-- 20260920000100_organization_team_roles.sql
-- ======================================================================

-- Migration: 20260920000100_organization_team_roles.sql
-- Description: Role-based access inside an organization.
--
-- Until now an organization was a single login (organizations.profile_id is
-- unique), so there was nobody to give a role to. This adds:
--   * organization_members     — who belongs to which organization, and as what
--   * organization_invitations — email invitations (token stored hashed)
--   * has_org_role()           — one helper the policies and API routes share
--
-- Roles (higher includes everything below it):
--   viewer  — read-only access to the organization's data
--   manager — viewer + create/edit needs, handle interests, fulfillments,
--             stories, documents, gift claims
--   owner   — manager + manage the team, edit the organization profile and
--             banking details, delete the account (the original login)
--
-- Existing "o.profile_id = auth.uid()" policies are deliberately LEFT ALONE.
-- Postgres ORs permissive policies together, so the original login (backfilled
-- below as the owner) keeps working exactly as before, and member access is
-- granted by the additive policies in this file. A profile can belong to at
-- most one organization (unique profile_id).

-- --- 1. Tables ------------------------------------------------------------

do $$
begin
  create type public.org_member_role as enum ('owner', 'manager', 'viewer');
exception when duplicate_object then null;
end $$;

create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  profile_id uuid not null unique references public.profiles(id) on delete cascade,
  role public.org_member_role not null default 'viewer',
  invited_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists organization_members_org_idx on public.organization_members(organization_id);

create table if not exists public.organization_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  role public.org_member_role not null check (role <> 'owner'),
  token_hash text not null unique,
  invited_by uuid references public.profiles(id) on delete set null,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists organization_invitations_org_idx on public.organization_invitations(organization_id);

-- Existing organization logins become owners.
insert into public.organization_members (organization_id, profile_id, role)
select id, profile_id, 'owner' from public.organizations
on conflict (profile_id) do nothing;

-- New organizations (created by handle_new_profile) get their owner row too.
create or replace function public.add_organization_owner_member()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.organization_members (organization_id, profile_id, role)
  values (new.id, new.profile_id, 'owner')
  on conflict (profile_id) do nothing;
  return new;
end;
$$;

drop trigger if exists organizations_add_owner_member on public.organizations;
create trigger organizations_add_owner_member
after insert on public.organizations
for each row execute function public.add_organization_owner_member();

-- --- 2. Helpers -----------------------------------------------------------

create or replace function public.org_role_rank(p_role public.org_member_role)
returns int
language sql
immutable
as $$
  select case p_role when 'owner' then 3 when 'manager' then 2 else 1 end;
$$;

-- True when the signed-in user belongs to p_org with at least p_min.
-- SECURITY DEFINER so evaluating it never re-enters RLS on organization_members
-- (same recursion trap fixed in 20260914001500 / 20260914001800).
create or replace function public.has_org_role(p_org uuid, p_min public.org_member_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id = p_org
      and m.profile_id = (select auth.uid())
      and public.org_role_rank(m.role) >= public.org_role_rank(p_min)
  );
$$;
grant execute on function public.has_org_role(uuid, public.org_member_role) to authenticated;

-- Organization that owns a need, bypassing RLS (used by policies on child tables).
create or replace function public.need_organization_id(p_need uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id from public.needs where id = p_need;
$$;
grant execute on function public.need_organization_id(uuid) to authenticated;

-- Can the signed-in team member see this giver (interested, donated or fulfilling)?
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
    where si.giver_id = p_giver and public.has_org_role(n.organization_id, 'viewer')
  ) or exists (
    select 1 from public.donations d
    where d.giver_id = p_giver and d.organization_id is not null
      and public.has_org_role(d.organization_id, 'viewer')
  ) or exists (
    select 1 from public.fulfillments f
    where f.giver_id = p_giver and public.has_org_role(f.organization_id, 'viewer')
  );
$$;
grant execute on function public.org_member_can_see_giver(uuid) to authenticated;

-- --- 3. RLS on the new tables --------------------------------------------
-- Members can read their organization's roster. There are no write policies:
-- the team-management API routes use the service role after checking the
-- caller is the owner. Invitations have no policies at all (service role only)
-- so tokens/emails are never readable from the browser.

alter table public.organization_members enable row level security;
alter table public.organization_invitations enable row level security;

drop policy if exists "Members can view their organization roster" on public.organization_members;
create policy "Members can view their organization roster"
on public.organization_members for select to authenticated
using (public.has_org_role(organization_id, 'viewer'));

-- --- 4. handle_new_profile: invited members get no organization/giver row --
-- Same body as 20260915000100 plus an early return for invited team members
-- (created by the invitation accept flow), who must not spawn an organization.

create or replace function public.handle_new_profile()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  metadata jsonb;
  category_text text;
  location_text text;
begin
  select raw_user_meta_data into metadata from auth.users where id = new.id;

  if metadata ->> 'invited_member' = 'true' then
    return new;
  end if;

  category_text := nullif(trim(metadata ->> 'categories'), '');
  location_text := nullif(trim(metadata ->> 'locations'), '');

  if new.role = 'organization' then
    insert into public.organizations (
      profile_id, name, registration_number, type, address, province, city,
      contact_name, contact_email, phone, mission
    ) values (
      new.id,
      coalesce(nullif(metadata ->> 'org_name', ''), new.full_name),
      metadata ->> 'reg_num',
      coalesce(nullif(metadata ->> 'org_type', ''), 'Other'),
      metadata ->> 'address',
      metadata ->> 'province',
      metadata ->> 'city',
      metadata ->> 'contact',
      new.email,
      new.phone,
      metadata ->> 'mission'
    ) on conflict (profile_id) do nothing;
  else
    insert into public.givers (
      profile_id, name, email, phone, account_type, preferred_categories, preferred_locations
    ) values (
      new.id,
      new.full_name,
      new.email,
      new.phone,
      coalesce(nullif(metadata ->> 'account_type', ''), 'individual'),
      case when category_text is null then '{}'::text[] else regexp_split_to_array(category_text, '\s*,\s*') end,
      case when location_text is null then '{}'::text[] else regexp_split_to_array(location_text, '\s*,\s*') end
    ) on conflict (profile_id) do nothing;
  end if;

  return new;
end;
$$;

-- --- 5. Additive member policies -----------------------------------------

-- organizations: any member can read their own organization (even before approval)
drop policy if exists "Members can view their organization" on public.organizations;
create policy "Members can view their organization"
on public.organizations for select to authenticated
using (public.has_org_role(id, 'viewer'));

-- needs
drop policy if exists "Members can view their needs" on public.needs;
create policy "Members can view their needs"
on public.needs for select to authenticated
using (public.has_org_role(organization_id, 'viewer'));

drop policy if exists "Managers can create needs" on public.needs;
create policy "Managers can create needs"
on public.needs for insert to authenticated
with check (public.has_org_role(organization_id, 'manager') and status = 'draft');

drop policy if exists "Managers can update needs" on public.needs;
create policy "Managers can update needs"
on public.needs for update to authenticated
using (public.has_org_role(organization_id, 'manager'))
with check (public.has_org_role(organization_id, 'manager'));

drop policy if exists "Managers can delete needs" on public.needs;
create policy "Managers can delete needs"
on public.needs for delete to authenticated
using (public.has_org_role(organization_id, 'manager'));

-- support_interests
drop policy if exists "Members can view interests for their needs" on public.support_interests;
create policy "Members can view interests for their needs"
on public.support_interests for select to authenticated
using (public.has_org_role(public.need_organization_id(need_id), 'viewer'));

drop policy if exists "Managers can update interests for their needs" on public.support_interests;
create policy "Managers can update interests for their needs"
on public.support_interests for update to authenticated
using (public.has_org_role(public.need_organization_id(need_id), 'manager'));

-- givers (so joins on interests / donations / fulfillments resolve for members)
drop policy if exists "Members can view givers tied to their organization" on public.givers;
create policy "Members can view givers tied to their organization"
on public.givers for select to authenticated
using (public.org_member_can_see_giver(givers.id));

-- fulfillments
drop policy if exists "Members can view fulfillments" on public.fulfillments;
create policy "Members can view fulfillments"
on public.fulfillments for select to authenticated
using (public.has_org_role(organization_id, 'viewer'));

drop policy if exists "Managers can create accepted fulfillments" on public.fulfillments;
create policy "Managers can create accepted fulfillments"
on public.fulfillments for insert to authenticated
with check (
  public.has_org_role(organization_id, 'manager')
  and exists (
    select 1 from public.support_interests i
    join public.needs n on n.id = i.need_id
    where i.id = interest_id
      and i.giver_id = fulfillments.giver_id
      and n.organization_id = fulfillments.organization_id
      and i.status = 'accepted'
  )
);

drop policy if exists "Managers can update fulfillments" on public.fulfillments;
create policy "Managers can update fulfillments"
on public.fulfillments for update to authenticated
using (public.has_org_role(organization_id, 'manager'))
with check (public.has_org_role(organization_id, 'manager'));

drop policy if exists "Members can view fulfillment proofs" on public.fulfillment_proofs;
create policy "Members can view fulfillment proofs"
on public.fulfillment_proofs for select to authenticated
using (exists (
  select 1 from public.fulfillments f
  where f.id = fulfillment_id and public.has_org_role(f.organization_id, 'viewer')
));

-- donations (read-only for the organization side)
drop policy if exists "Members can view donations to their organization" on public.donations;
create policy "Members can view donations to their organization"
on public.donations for select to authenticated
using (organization_id is not null and public.has_org_role(organization_id, 'viewer'));

-- organization documents
drop policy if exists "Members can view organization documents" on public.organization_documents;
create policy "Members can view organization documents"
on public.organization_documents for select to authenticated
using (public.has_org_role(organization_id, 'viewer'));

drop policy if exists "Managers can add organization documents" on public.organization_documents;
create policy "Managers can add organization documents"
on public.organization_documents for insert to authenticated
with check (uploaded_by = (select auth.uid()) and public.has_org_role(organization_id, 'manager'));

-- Files live under <uploader user id>/..., so let teammates read each other's.
drop policy if exists "Members can read teammates' organization documents" on storage.objects;
create policy "Members can read teammates' organization documents"
on storage.objects for select to authenticated
using (
  bucket_id = 'organization-documents'
  and exists (
    select 1 from public.organization_members mine
    join public.organization_members theirs on theirs.organization_id = mine.organization_id
    where mine.profile_id = (select auth.uid())
      and theirs.profile_id::text = (storage.foldername(name))[1]
  )
);

-- impact stories
drop policy if exists "Managers can create impact stories" on public.impact_stories;
create policy "Managers can create impact stories"
on public.impact_stories for insert to authenticated
with check (public.has_org_role(organization_id, 'manager'));

drop policy if exists "Managers can update impact stories" on public.impact_stories;
create policy "Managers can update impact stories"
on public.impact_stories for update to authenticated
using (public.has_org_role(organization_id, 'manager'));

drop policy if exists "Managers can delete impact stories" on public.impact_stories;
create policy "Managers can delete impact stories"
on public.impact_stories for delete to authenticated
using (public.has_org_role(organization_id, 'manager'));

drop policy if exists "Managers can delete impact story media" on public.impact_story_media;
create policy "Managers can delete impact story media"
on public.impact_story_media for delete to authenticated
using (exists (
  select 1 from public.impact_stories s
  where s.id = story_id and public.has_org_role(s.organization_id, 'manager')
));

-- gift library claims
drop policy if exists "Members can view offerings their organization claimed" on public.gift_offerings;
create policy "Members can view offerings their organization claimed"
on public.gift_offerings for select to authenticated
using (claimed_by_org_id is not null and public.has_org_role(claimed_by_org_id, 'viewer'));

drop policy if exists "Managers can claim offerings" on public.gift_offerings;
create policy "Managers can claim offerings"
on public.gift_offerings for update to authenticated
using (
  status = 'approved'
  and exists (
    select 1 from public.organization_members m
    join public.organizations o on o.id = m.organization_id
    where m.profile_id = (select auth.uid())
      and m.role in ('owner', 'manager')
      and o.verification_status = 'approved'
  )
)
with check (
  status = 'pending_claim'
  and public.has_org_role(claimed_by_org_id, 'manager')
  and exists (
    select 1 from public.organizations o
    where o.id = claimed_by_org_id and o.verification_status = 'approved'
  )
);

-- verification history
drop policy if exists "Members can view their verification history" on public.organization_verification_history;
create policy "Members can view their verification history"
on public.organization_verification_history for select to authenticated
using (public.has_org_role(organization_id, 'viewer'));

-- --- 6. Upload helpers: same checks, membership-aware ---------------------
-- Bodies are unchanged from their originals except the ownership test, which
-- now accepts a manager (or the owner) of the organization.

create or replace function public.add_need_attachment(p_need_id uuid, p_storage_path text, p_file_name text)
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
    select 1 from public.needs n
    where n.id = p_need_id and public.has_org_role(n.organization_id, 'manager')
  ) then
    raise exception 'You are not permitted to attach files to this need.';
  end if;

  insert into public.need_attachments (need_id, storage_path, file_name, uploaded_by)
  values (p_need_id, p_storage_path, p_file_name, v_uid)
  returning id into v_new_id;

  return v_new_id;
end;
$$;

create or replace function public.remove_need_attachment(p_attachment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Authentication required.';
  end if;

  delete from public.need_attachments na
  using public.needs n
  where na.id = p_attachment_id
    and na.need_id = n.id
    and public.has_org_role(n.organization_id, 'manager');
end;
$$;

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
    where f.id = p_fulfillment_id and public.has_org_role(f.organization_id, 'manager')
  ) then
    raise exception 'You are not permitted to add proof to this fulfillment.';
  end if;

  insert into public.fulfillment_proofs (fulfillment_id, storage_path, file_name, uploaded_by)
  values (p_fulfillment_id, p_storage_path, p_file_name, v_uid)
  returning id into v_new_id;

  return v_new_id;
end;
$$;

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
    where s.id = p_story_id and public.has_org_role(s.organization_id, 'manager')
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

-- ======================================================================
-- 20260920000200_multi_owner_and_member_messaging.sql
-- ======================================================================

-- Migration: 20260920000200_multi_owner_and_member_messaging.sql
-- Description: Follow-up to 20260920000100_organization_team_roles.sql.
--
--   1. An organization can have several owners. Owners can invite/promote other
--      owners, so the "role <> 'owner'" restriction on invitations is dropped.
--   2. Any owner (not just the original login, organizations.profile_id) can
--      edit the organization's profile and banking details.
--   3. Managers and owners can message givers, not just the original login.
--      send_notification() is the single choke point for messaging (see
--      20260918000300_message_sender_details.sql); its organization -> giver
--      relationship check now goes through has_org_role() instead of
--      "o.profile_id = sender". Everything else in it is unchanged.
--
-- organizations.profile_id is still the organization's "account holder"; the
-- application keeps it protected from removal/demotion because deleting that
-- profile cascades to the organization itself (see api/organization/team).

-- --- 1. Owners can be invited ---------------------------------------------

alter table public.organization_invitations
  drop constraint if exists organization_invitations_role_check;

-- --- 2. Any owner can edit the organization -------------------------------
-- verification_status stays admin-only via guard_organization_verification_status()
-- (a trigger, so it applies to these updates too).

drop policy if exists "Owners can update their organization" on public.organizations;
create policy "Owners can update their organization"
on public.organizations for update to authenticated
using (public.has_org_role(id, 'owner'))
with check (public.has_org_role(id, 'owner'));

-- --- 3. Managers can message givers ---------------------------------------

create or replace function public.send_notification(
  p_recipient uuid,
  p_type text,
  p_title text,
  p_message text,
  p_attachment_storage_path text default null,
  p_attachment_file_name text default null
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
begin
  if v_sender is null then
    raise exception 'Authentication required.';
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

  -- A giver may message any organization — organizations are public
  -- entities (listed on the needs board and their own profile page).
  if not v_allowed and v_sender_role = 'giver' and v_recipient_role = 'organization' then
    v_allowed := true;
  end if;

  -- An organization team member (manager or owner; viewers are read-only) may
  -- message a giver the organization has an existing relationship with
  -- (expressed interest, donated, or has a fulfillment together).
  if not v_allowed and v_sender_role = 'organization' and v_recipient_role = 'giver' then
    v_allowed := exists (
      select 1
      from public.support_interests si
      join public.needs n on n.id = si.need_id
      join public.givers g on g.id = si.giver_id
      where g.profile_id = p_recipient and public.has_org_role(n.organization_id, 'manager')
    ) or exists (
      select 1
      from public.donations d
      join public.givers g on g.id = d.giver_id
      where g.profile_id = p_recipient
        and d.organization_id is not null
        and public.has_org_role(d.organization_id, 'manager')
    ) or exists (
      select 1
      from public.fulfillments f
      join public.givers g on g.id = f.giver_id
      where g.profile_id = p_recipient and public.has_org_role(f.organization_id, 'manager')
    );
  end if;

  if not v_allowed then
    raise exception 'You are not permitted to message this recipient.';
  end if;

  insert into public.notifications (recipient_id, sender_id, sender_name, sender_role, type, title, message, attachment_storage_path, attachment_file_name)
  values (p_recipient, v_sender, v_sender_name, v_sender_role, p_type, p_title, p_message, p_attachment_storage_path, p_attachment_file_name)
  returning id into v_new_id;

  return v_new_id;
end;
$$;

-- ======================================================================
-- 20260920000300_notify_whole_team.sql
-- ======================================================================

-- Migration: 20260920000300_notify_whole_team.sql
-- Description: Every organization team member (owners, managers and viewers)
-- receives the organization's notifications, not just the original account
-- holder.
--
-- All existing code addresses organization notifications to
-- organizations.profile_id (interests, donations, fulfillments, gift claims,
-- admin messages, giver messages, announcements...). Rather than touch every
-- one of those code paths, a trigger copies each notification addressed to an
-- organization's account holder to the rest of that organization's team.
-- Copies are ordinary notifications, so the existing email webhook
-- (api/webhooks/notification-created) emails each member too, and each person
-- has their own read/unread state.
--
-- Only notifications created from now on are copied; nothing is back-filled.

alter table public.notifications
  add column if not exists fanned_from uuid references public.notifications(id) on delete cascade;
create index if not exists notifications_fanned_from_idx on public.notifications(fanned_from);

create or replace function public.fan_out_organization_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Copies are marked with fanned_from, so they never fan out again.
  if new.fanned_from is not null then
    return new;
  end if;

  insert into public.notifications (
    recipient_id, sender_id, sender_name, sender_role, type, title, message,
    attachment_storage_path, attachment_file_name, fanned_from
  )
  select
    m.profile_id, new.sender_id, new.sender_name, new.sender_role, new.type, new.title, new.message,
    new.attachment_storage_path, new.attachment_file_name, new.id
  from public.organizations o
  join public.organization_members m on m.organization_id = o.id
  where o.profile_id = new.recipient_id
    and m.profile_id <> new.recipient_id
    and m.profile_id is distinct from new.sender_id;

  return new;
end;
$$;

drop trigger if exists notifications_fan_out_to_team on public.notifications;
create trigger notifications_fan_out_to_team
after insert on public.notifications
for each row execute function public.fan_out_organization_notification();

-- Files attached to a message are added AFTER the message row exists
-- (add_notification_attachment), so give each copy the same attachments.
create or replace function public.fan_out_notification_attachment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notification_attachments (notification_id, storage_path, file_name, uploaded_by)
  select c.id, new.storage_path, new.file_name, new.uploaded_by
  from public.notifications c
  where c.fanned_from = new.notification_id;
  return new;
end;
$$;

drop trigger if exists notification_attachments_fan_out_to_team on public.notification_attachments;
create trigger notification_attachments_fan_out_to_team
after insert on public.notification_attachments
for each row execute function public.fan_out_notification_attachment();

-- ======================================================================
-- 20260920000400_admin_messaging_owner_manager_only.sql
-- ======================================================================

-- Migration: 20260920000400_admin_messaging_owner_manager_only.sql
-- Description: Communication with the administrators is limited to an
-- organization's owners and managers. Viewers are read-only, so they can no
-- longer message an admin (previously "anyone may message an admin").
--
-- Same function as 20260920000200_multi_owner_and_member_messaging.sql; the
-- only change is the admin branch below. Givers, admins and organization
-- accounts that aren't team viewers are unaffected.

create or replace function public.send_notification(
  p_recipient uuid,
  p_type text,
  p_title text,
  p_message text,
  p_attachment_storage_path text default null,
  p_attachment_file_name text default null
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
begin
  if v_sender is null then
    raise exception 'Authentication required.';
  end if;

  select full_name, role into v_sender_name, v_sender_role from public.profiles where id = v_sender;
  select role into v_recipient_role from public.profiles where id = p_recipient;

  if v_recipient_role is null then
    raise exception 'Recipient not found.';
  end if;

  if public.is_suspended() and v_recipient_role <> 'admin' then
    raise exception 'Your account is suspended. You may only message an administrator.';
  end if;

  -- Admins may message anyone; anyone may message an admin — except a
  -- read-only organization viewer, who may not.
  if v_sender_role = 'admin' or v_recipient_role = 'admin' then
    if v_sender_role = 'organization' and exists (
      select 1 from public.organization_members m
      where m.profile_id = v_sender and m.role = 'viewer'
    ) then
      raise exception 'Viewers can''t message administrators. Ask an owner or manager to do it.';
    end if;
    v_allowed := true;
  end if;

  -- A giver may message any organization — organizations are public
  -- entities (listed on the needs board and their own profile page).
  if not v_allowed and v_sender_role = 'giver' and v_recipient_role = 'organization' then
    v_allowed := true;
  end if;

  -- An organization team member (manager or owner; viewers are read-only) may
  -- message a giver the organization has an existing relationship with
  -- (expressed interest, donated, or has a fulfillment together).
  if not v_allowed and v_sender_role = 'organization' and v_recipient_role = 'giver' then
    v_allowed := exists (
      select 1
      from public.support_interests si
      join public.needs n on n.id = si.need_id
      join public.givers g on g.id = si.giver_id
      where g.profile_id = p_recipient and public.has_org_role(n.organization_id, 'manager')
    ) or exists (
      select 1
      from public.donations d
      join public.givers g on g.id = d.giver_id
      where g.profile_id = p_recipient
        and d.organization_id is not null
        and public.has_org_role(d.organization_id, 'manager')
    ) or exists (
      select 1
      from public.fulfillments f
      join public.givers g on g.id = f.giver_id
      where g.profile_id = p_recipient and public.has_org_role(f.organization_id, 'manager')
    );
  end if;

  if not v_allowed then
    raise exception 'You are not permitted to message this recipient.';
  end if;

  insert into public.notifications (recipient_id, sender_id, sender_name, sender_role, type, title, message, attachment_storage_path, attachment_file_name)
  values (p_recipient, v_sender, v_sender_name, v_sender_role, p_type, p_title, p_message, p_attachment_storage_path, p_attachment_file_name)
  returning id into v_new_id;

  return v_new_id;
end;
$$;

-- ======================================================================
-- 20260920000500_documents_owner_only.sql
-- ======================================================================

-- Migration: 20260920000500_documents_owner_only.sql
-- Description: Only organization owners may upload verification documents.
-- Replaces the manager-level insert policy from
-- 20260920000100_organization_team_roles.sql. Managers and viewers can still
-- read the organization's documents.

drop policy if exists "Managers can add organization documents" on public.organization_documents;
drop policy if exists "Owners can add organization documents" on public.organization_documents;
create policy "Owners can add organization documents"
on public.organization_documents for insert to authenticated
with check (uploaded_by = (select auth.uid()) and public.has_org_role(organization_id, 'owner'));
