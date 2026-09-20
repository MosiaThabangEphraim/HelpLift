-- Migration: 20260919000100_need_matching_notifications.sql
-- Description: Matching system. When an admin publishes a need, notify every
-- giver whose saved preferences (givers.preferred_categories /
-- givers.preferred_locations) match it.
--
-- Matching rules:
--   * A giver with no preferences at all is NOT notified (they haven't opted in).
--   * Each preference list the giver did set must match; an empty list means
--     "no restriction" for that dimension.
--   * Categories match case-insensitively and exactly.
--   * Locations match if any preference is a case-insensitive substring of the
--     need's location or its organization's city/province.
--
-- Runs as security definer because the calling admin can't read other givers'
-- rows through RLS in a way that's safe to rely on here, and it is admin-gated
-- explicitly. Safe to call repeatedly: an identical notification is never
-- inserted twice for the same giver.

create or replace function public.notify_matching_givers(p_need_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_need record;
  v_message text;
  v_count integer;
begin
  if not public.is_admin() then
    raise exception 'Administrator access required.';
  end if;

  select n.id, n.title, n.category, n.location, n.status,
         o.city as org_city, o.province as org_province
    into v_need
    from public.needs n
    left join public.organizations o on o.id = n.organization_id
   where n.id = p_need_id;

  if not found or v_need.status <> 'open' then
    return 0;
  end if;

  v_message := format(
    '"%s" (%s) was just published and matches your preferences. View it on the needs board.',
    v_need.title, v_need.category
  );

  with matches as (
    select g.profile_id
      from public.givers g
     where g.profile_id is not null
       and (cardinality(g.preferred_categories) > 0 or cardinality(g.preferred_locations) > 0)
       and (
         cardinality(g.preferred_categories) = 0
         or exists (
           select 1 from unnest(g.preferred_categories) c
            where lower(btrim(c)) = lower(btrim(v_need.category))
         )
       )
       and (
         cardinality(g.preferred_locations) = 0
         or exists (
           select 1 from unnest(g.preferred_locations) l
            where btrim(l) <> ''
              and lower(concat_ws(' ', v_need.location, v_need.org_city, v_need.org_province))
                  like '%' || lower(btrim(l)) || '%'
         )
       )
       and not exists (
         select 1 from public.notifications x
          where x.recipient_id = g.profile_id
            and x.type = 'need_match'
            and x.message = v_message
       )
  ), inserted as (
    insert into public.notifications (recipient_id, sender_id, type, title, message)
    select m.profile_id, auth.uid(), 'need_match', 'A new need matches your interests', v_message
      from matches m
    returning 1
  )
  select count(*) into v_count from inserted;

  return v_count;
end;
$$;

revoke all on function public.notify_matching_givers(uuid) from public, anon;
grant execute on function public.notify_matching_givers(uuid) to authenticated;
