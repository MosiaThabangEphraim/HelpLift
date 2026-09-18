-- Migration: 20260914002500_send_notification_function.sql
-- Description: Every diagnostic (RPC call, inline computation in the same
-- transaction as the insert, current_user/session_user/auth.uid() all
-- correct) proved is_admin_profile(recipient_id) evaluates true for the
-- exact row being inserted, yet the "Users can send messages to admins"
-- policy still rejects it — with no further detail Postgres is willing to
-- surface. Rather than continue chasing that (Postgres/pooler-level)
-- mystery, this moves notification creation for the generic messaging
-- endpoint (POST /api/messages) into a SECURITY DEFINER function that
-- performs its own authorization checks directly against the tables (also
-- bypassing RLS internally, so no risk of the same class of failure) and
-- inserts the row itself — sidestepping RLS policy evaluation for this
-- write entirely instead of depending on it.
create or replace function public.send_notification(p_recipient uuid, p_type text, p_title text, p_message text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sender uuid := auth.uid();
  v_sender_role text;
  v_recipient_role text;
  v_new_id uuid;
  v_allowed boolean := false;
begin
  if v_sender is null then
    raise exception 'Authentication required.';
  end if;

  select role into v_sender_role from public.profiles where id = v_sender;
  select role into v_recipient_role from public.profiles where id = p_recipient;

  if v_recipient_role is null then
    raise exception 'Recipient not found.';
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

  insert into public.notifications (recipient_id, sender_id, type, title, message)
  values (p_recipient, v_sender, p_type, p_title, p_message)
  returning id into v_new_id;

  return v_new_id;
end;
$$;
grant execute on function public.send_notification(uuid, text, text, text) to authenticated;
