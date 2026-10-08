-- Migration: 20261008000400_need_end_notifications.sql
-- Description: When the nightly job (20261008000300) closes a need because
-- its due date passed, the givers behind it are now told too: anyone with a
-- pending or accepted offer on it, or a successful donation to it. Matches
-- what the app does when an organization closes or fulfils a need, or an
-- admin deletes one (lib/need-notifications.ts).
--
-- Same function as before, with one more notification step. The pg_cron
-- schedule from 20261008000300 keeps calling it by name, so it doesn't need
-- to be scheduled again.

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
  ), notified_orgs as (
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
  ), supporters as (
    -- Givers with an open offer on, or a successful donation to, each closed need.
    select distinct c.id as need_id, c.title, org.name as org_name, g.profile_id
    from closed c
    join public.organizations org on org.id = c.organization_id
    join (
      select si.need_id, si.giver_id from public.support_interests si where si.status in ('pending', 'accepted')
      union
      select d.need_id, d.giver_id from public.donations d where d.status = 'successful' and d.need_id is not null
    ) s on s.need_id = c.id
    join public.givers g on g.id = s.giver_id
  ), notified_givers as (
    insert into public.notifications (recipient_id, sender_name, type, title, message)
    select sp.profile_id,
           'HelpLift Notifications',
           'need_status_update',
           'A need you supported was closed',
           format('"%s" from %s reached its due date and was closed, so it no longer accepts offers or donations. Any donation you already made stays with the organization.',
                  sp.title, sp.org_name)
    from supporters sp
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

revoke all on function public.expire_overdue_items() from public, anon, authenticated;
grant execute on function public.expire_overdue_items() to service_role;
