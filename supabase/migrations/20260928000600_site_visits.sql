-- Lightweight, first-party site-visit tracking for the admin Reports tab.
-- One row per browser SESSION (not every page view), recorded by
-- components/site-visit-tracker.tsx the first time each tab loads the site.
-- No PII is stored - just an anonymous, locally-generated visitor id (so
-- repeat visits from the same browser count once toward "unique visitors"),
-- a per-tab session id (so a page refresh doesn't count as a second visit),
-- the landing path, and a timestamp.
create table if not exists public.site_visits (
  id uuid primary key default gen_random_uuid(),
  visitor_id text not null,
  session_id text not null,
  path text,
  created_at timestamptz not null default now()
);

create unique index if not exists site_visits_session_id_key on public.site_visits(session_id);
create index if not exists site_visits_created_at_idx on public.site_visits(created_at);

alter table public.site_visits enable row level security;

-- Anyone browsing the public site can record their own visit - there's
-- nothing sensitive in the row, and it has to work for signed-out guests.
drop policy if exists "Anyone can record a site visit" on public.site_visits;
create policy "Anyone can record a site visit"
on public.site_visits for insert to anon, authenticated
with check (true);

drop policy if exists "Admins can view site visits" on public.site_visits;
create policy "Admins can view site visits"
on public.site_visits for select to authenticated
using (public.is_admin());

-- Aggregating in the database (rather than shipping every raw row to the
-- browser) is what keeps this cheap as the table grows. Both functions
-- refuse outright unless the caller is an admin, same defense-in-depth
-- pattern as get_last_seen: even though the "Admins can view site visits"
-- policy already covers this, the check is repeated here so the function
-- can never be relied on to do more than the policy allows.
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
    (created_at at time zone 'utc')::date as day,
    count(*)::bigint as visits,
    count(distinct visitor_id)::bigint as unique_visitors
  from public.site_visits
  where (created_at at time zone 'utc')::date between p_from and p_to
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
    date_trunc('month', created_at at time zone 'utc')::date as month,
    count(*)::bigint as visits,
    count(distinct visitor_id)::bigint as unique_visitors
  from public.site_visits
  where (created_at at time zone 'utc')::date between p_from and p_to
  group by 1
  order by 1;
end;
$$;

grant execute on function public.admin_site_visit_monthly(date, date) to authenticated;
