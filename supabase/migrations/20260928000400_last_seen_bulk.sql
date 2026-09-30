-- Bulk companion to get_last_seen(uuid) (see 20260928000300_last_seen_and_message_status.sql),
-- for list views that need many people's last-seen at once (the organization
-- directory) without one round trip per row. Same privacy rule: a profile
-- with show_last_seen off comes back with a null last_seen_at, never omitted
-- from the result (omitting it would itself leak that it's hidden).
create or replace function public.get_last_seen_bulk(p_profile_ids uuid[])
returns table(profile_id uuid, last_seen_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select id, case when show_last_seen then last_seen_at else null end
  from public.profiles
  where id = any(p_profile_ids)
$$;

grant execute on function public.get_last_seen_bulk(uuid[]) to authenticated, anon;
