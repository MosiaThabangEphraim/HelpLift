-- Migration: 20261008000300_expire_overdue_needs_and_gifts.sql
-- Description: Needs and Gift Library offerings come off the platform once
-- their date has passed.
--
-- - An OPEN need whose due date is before today (South African time) is
--   closed, and the organization is notified. It can ask to reopen it with a
--   new due date (admin review, as before). Needs already in progress (an
--   offer was accepted) are not closed, so deliveries under way can finish,
--   but they are hidden from the public lists by the app.
-- - A pending or approved Gift Library offering whose expiry date is before
--   today is marked 'expired', and the giver is notified. Offerings with a
--   claim in progress are left for the admin to decide.
-- - Money never expires: donations have no end date, and financial pledges
--   (already paid through the donation flow) are always skipped.
--
-- Runs daily with pg_cron where available; the app also calls it as a safety
-- net (lib/expiry.ts) and hides anything past its date from public lists
-- straight away.

create or replace function public.expire_overdue_items()
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  today date := (now() at time zone 'Africa/Johannesburg')::date;
  closed_needs integer := 0;
  expired_gifts integer := 0;
begin
  with closed as (
    update public.needs n
    set status = 'closed'
    where n.status = 'open'
      and n.due_date is not null
      and n.due_date < today
    returning n.id, n.title, n.due_date, n.organization_id
  ), notified as (
    insert into public.notifications (recipient_id, sender_name, type, title, message)
    select o.profile_id,
           'HelpLift Notifications',
           'need_status_update',
           'Need closed - due date passed',
           format('Your need "%s" was closed automatically because its due date (%s) has passed. If you still need help with it, open it in your Needs tab and request to reopen it with a new due date.',
                  c.title, to_char(c.due_date, 'DD Mon YYYY'))
    from closed c
    join public.organizations o on o.id = c.organization_id
    where o.profile_id is not null
    returning 1
  )
  select count(*) into closed_needs from closed;

  with expired as (
    update public.gift_offerings g
    set status = 'expired', updated_at = now()
    where g.status in ('pending', 'approved')
      and g.offering_type <> 'financial'
      and g.expiry_date is not null
      and g.expiry_date < today
    returning g.id, g.title, g.expiry_date, g.giver_id
  ), notified as (
    insert into public.notifications (recipient_id, sender_name, type, title, message)
    select gv.profile_id,
           'HelpLift Notifications',
           'gift_offering_reviewed',
           'Gift offering expired',
           format('Your Gift Library offering "%s" reached its expiry date (%s) and is no longer listed. You can pledge it again any time from your Gift Library tab.',
                  e.title, to_char(e.expiry_date, 'DD Mon YYYY'))
    from expired e
    join public.givers gv on gv.id = e.giver_id
    returning 1
  )
  select count(*) into expired_gifts from expired;

  return jsonb_build_object('closed_needs', closed_needs, 'expired_gifts', expired_gifts);
end;
$$;

-- Server-only (the app calls it with the service role).
revoke all on function public.expire_overdue_items() from public, anon, authenticated;
grant execute on function public.expire_overdue_items() to service_role;

-- Every day at 00:05 South African time (22:05 UTC). If pg_cron can't be
-- enabled, the migration still succeeds and the app's own call covers it.
do $outer$
begin
  create extension if not exists pg_cron;
  perform cron.schedule(
    'helplift-expire-overdue-items',
    '5 22 * * *',
    $job$select public.expire_overdue_items()$job$
  );
exception when others then
  raise notice 'pg_cron is not available (%); overdue needs and gifts are expired by the app instead.', sqlerrm;
end;
$outer$;

-- Catch up on anything already past its date.
select public.expire_overdue_items();
