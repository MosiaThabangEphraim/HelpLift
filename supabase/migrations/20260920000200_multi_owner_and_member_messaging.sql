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
