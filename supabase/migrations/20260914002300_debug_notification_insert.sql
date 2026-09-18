-- Migration: 20260914002300_debug_notification_insert.sql
-- Description: One more diagnostic step for the still-failing "message admin"
-- RLS error. is_admin_profile(recipient_id) has been proven to return true
-- for the exact recipient/sender/session involved (via RPC, same request),
-- which should be sufficient for "Users can send messages to admins" to pass
-- — yet the insert still fails. This function is SECURITY INVOKER (runs with
-- the CALLER's own privileges/RLS, unlike every other helper so far, which
-- were SECURITY DEFINER), so calling it reproduces exactly what the app's
-- direct insert does, but wrapped in an exception handler that surfaces the
-- full SQLSTATE/message/detail/hint/context Postgres actually raised — detail
-- PostgREST normally swallows down to the generic "violates row-level
-- security policy" line. It always rolls back its own test insert, so it
-- never leaves data behind.
create or replace function public.debug_test_notification_insert(p_recipient uuid, p_type text)
returns table (ok boolean, sqlstate_code text, err_message text, err_detail text, err_hint text, err_context text)
language plpgsql
security invoker
set search_path = public
as $$
declare
  new_id uuid;
  v_sqlstate text;
  v_message text;
  v_detail text;
  v_hint text;
  v_context text;
begin
  begin
    insert into public.notifications (recipient_id, sender_id, type, title, message)
    values (p_recipient, auth.uid(), p_type, 'debug', 'debug')
    returning id into new_id;

    -- Force a rollback of the test row without aborting the caller's session.
    raise exception 'debug_rollback';
  exception
    when others then
      get stacked diagnostics
        v_sqlstate = returned_sqlstate,
        v_message = message_text,
        v_detail = pg_exception_detail,
        v_hint = pg_exception_hint,
        v_context = pg_exception_context;

      if v_message = 'debug_rollback' then
        return query select true, null::text, null::text, null::text, null::text, null::text;
      else
        return query select false, v_sqlstate, v_message, v_detail, v_hint, v_context;
      end if;
  end;
end;
$$;
grant execute on function public.debug_test_notification_insert(uuid, text) to authenticated;
