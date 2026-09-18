-- Migration: 20260914002400_debug_auth_context.sql
-- Description: Narrower diagnostic. is_admin_profile(recipient) has proven
-- true via a standalone RPC call, and also fails identically inside a
-- SECURITY INVOKER function reproducing the real insert — so the next thing
-- to rule out is whether auth.uid() and is_admin_profile() resolve
-- differently when evaluated in the SAME statement/transaction as the
-- insert itself, versus a separate round trip. This computes everything
-- inline, immediately before attempting (and always rolling back) the
-- insert, so there is no gap in which anything could differ.
create or replace function public.debug_auth_context(p_recipient uuid, p_type text)
returns table (
  current_user_name text,
  session_user_name text,
  auth_uid uuid,
  is_admin_profile_inline boolean,
  insert_ok boolean,
  sqlstate_code text,
  err_message text
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  new_id uuid;
  v_sqlstate text;
  v_message text;
  v_ok boolean := true;
begin
  begin
    insert into public.notifications (recipient_id, sender_id, type, title, message)
    values (p_recipient, auth.uid(), p_type, 'debug', 'debug')
    returning id into new_id;
    raise exception 'debug_rollback';
  exception
    when others then
      get stacked diagnostics v_sqlstate = returned_sqlstate, v_message = message_text;
      if v_message = 'debug_rollback' then
        v_ok := true;
        v_sqlstate := null;
        v_message := null;
      else
        v_ok := false;
      end if;
  end;

  return query select
    current_user::text,
    session_user::text,
    auth.uid(),
    public.is_admin_profile(p_recipient),
    v_ok,
    v_sqlstate,
    v_message;
end;
$$;
grant execute on function public.debug_auth_context(uuid, text) to authenticated;
