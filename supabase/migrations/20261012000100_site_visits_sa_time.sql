-- Migration: 20261012000100_site_visits_sa_time.sql
-- Description: Site-visit stats (admin Reports tab) count days and months in
-- South African time (Africa/Johannesburg, UTC+2) instead of UTC. Before,
-- a "day" ran from 02:00 to 02:00 SAST, so visits just after midnight landed
-- on the previous day (and month). Same functions, same output - only the
-- time zone used to group visits changes. No stored rows are modified: the
-- grouping happens when the stats are read.

create or replace function public.admin_site_visit_daily(p_from date, p_to date)
returns table(day date, visits bigint, unique_visitors bigint)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Administrator access required.';
  end if;

  return query
  select
    (created_at at time zone 'Africa/Johannesburg')::date as day,
    count(*)::bigint as visits,
    count(distinct visitor_id)::bigint as unique_visitors
  from public.site_visits
  where (created_at at time zone 'Africa/Johannesburg')::date between p_from and p_to
  group by 1
  order by 1;
end;
$$;

grant execute on function public.admin_site_visit_daily(date, date) to authenticated;

create or replace function public.admin_site_visit_monthly(p_from date, p_to date)
returns table(month date, visits bigint, unique_visitors bigint)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Administrator access required.';
  end if;

  return query
  select
    date_trunc('month', created_at at time zone 'Africa/Johannesburg')::date as month,
    count(*)::bigint as visits,
    count(distinct visitor_id)::bigint as unique_visitors
  from public.site_visits
  where (created_at at time zone 'Africa/Johannesburg')::date between p_from and p_to
  group by 1
  order by 1;
end;
$$;

grant execute on function public.admin_site_visit_monthly(date, date) to authenticated;
