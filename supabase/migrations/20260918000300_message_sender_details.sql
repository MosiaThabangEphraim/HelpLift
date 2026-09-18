-- Migration: 20260918000300_message_sender_details.sql
-- Description: The Messages views (admin/giver/organisation dashboards) show
-- a notification's title/message but never who sent it as structured data —
-- the sender's name is only ever embedded inside the free-text `title`
-- ("Message from X"), not queryable/displayable on its own. A live join to
-- profiles at read time won't work generally: "Users can view their own
-- profile" (id = auth.uid()) is the only broad SELECT policy on profiles, so
-- a giver reading a message FROM an organization or admin has no RLS path to
-- that sender's profile row. Denormalizing name/role onto the notification
-- row at send time (same moment send_notification() already looks the
-- sender up to build the title text) sidesteps that entirely.

alter table public.notifications add column if not exists sender_name text;
alter table public.notifications add column if not exists sender_role text;

-- Same signature as 20260918000200_harden_suspension_enforcement.sql — just
-- adding sender_name/sender_role to what gets stored, no other logic change.
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

  -- An organization may message a giver it has an existing relationship
  -- with (expressed interest, donated, or has a fulfillment together).
  if not v_allowed and v_sender_role = 'organization' and v_recipient_role = 'giver' then
    v_allowed := exists (
      select 1
      from public.support_interests si
      join public.needs n on n.id = si.need_id
      join public.organizations o on o.id = n.organization_id
      join public.givers g on g.id = si.giver_id
      where o.profile_id = v_sender and g.profile_id = p_recipient
    ) or exists (
      select 1
      from public.donations d
      join public.organizations o on o.id = d.organization_id
      join public.givers g on g.id = d.giver_id
      where o.profile_id = v_sender and g.profile_id = p_recipient
    ) or exists (
      select 1
      from public.fulfillments f
      join public.organizations o on o.id = f.organization_id
      join public.givers g on g.id = f.giver_id
      where o.profile_id = v_sender and g.profile_id = p_recipient
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
