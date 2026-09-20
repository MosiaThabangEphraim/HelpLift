-- Migration: 20260920000800_organization_to_organization_messaging.sql
-- Description: The Organizations directory lets any user message an
-- organization, including another organization. send_notification() only
-- allowed organization -> giver (with an existing relationship), so an
-- organization messaging another organization was rejected.
--
-- Adds: an organization team member with owner or manager access may message
-- another organization's account holder (viewers stay read-only, and it isn't
-- allowed to message yourself). Everything else is identical to
-- 20260920000700_message_replies.sql.

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

  -- Admins may message anyone; anyone may message an admin, except a
  -- read-only organization viewer.
  if v_sender_role = 'admin' or v_recipient_role = 'admin' then
    if v_sender_role = 'organization' and exists (
      select 1 from public.organization_members m
      where m.profile_id = v_sender and m.role = 'viewer'
    ) then
      raise exception 'Viewers can''t message administrators. Ask an owner or manager to do it.';
    end if;
    v_allowed := true;
  end if;

  -- A giver may message any organization.
  if not v_allowed and v_sender_role = 'giver' and v_recipient_role = 'organization' then
    v_allowed := true;
  end if;

  -- An organization team member (manager or owner) may message a giver the
  -- organization has an existing relationship with.
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

  -- An organization owner or manager may message another organization (from
  -- the Organizations directory).
  if not v_allowed and v_sender_role = 'organization' and v_recipient_role = 'organization' then
    v_allowed := p_recipient <> v_sender and exists (
      select 1 from public.organization_members m
      where m.profile_id = v_sender and m.role in ('owner', 'manager')
    );
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
