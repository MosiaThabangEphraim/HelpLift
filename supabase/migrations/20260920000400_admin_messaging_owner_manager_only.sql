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
