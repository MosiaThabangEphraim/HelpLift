-- Migration: 20260914002000_fix_donations_givers_rls_recursion.sql
-- Description: Fixes "infinite recursion detected in policy for relation givers",
-- reintroduced by 20260914001900_donations.sql.
--
-- Root cause: that migration's "Organizations can view donors to their needs"
-- policy on public.givers queries public.donations in a correlated subquery.
-- Reading donations requires Postgres to evaluate ITS OWN policies, including
-- "Givers can view their own donations", which queries public.givers. That
-- re-enters the very policy being evaluated — givers -> donations -> givers ->
-- donations -> ... — infinite recursion. Identical failure pattern to
-- 20260914001800_fix_givers_rls_recursion.sql, just via the donations table
-- instead of support_interests.
--
-- Fix: same approach — move the cross-table check into a SECURITY DEFINER
-- function, which bypasses RLS entirely for its own internal queries, so
-- evaluating it never re-triggers the policies on givers/donations/
-- organizations in the first place.

create or replace function public.org_has_donor_giver_profile(giver_profile_id uuid, org_profile_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.donations d
    join public.givers g on g.id = d.giver_id
    join public.organizations o on o.id = d.organization_id
    where g.profile_id = giver_profile_id
      and o.profile_id = org_profile_id
  );
$$;

drop policy if exists "Organizations can view donors to their needs" on public.givers;
create policy "Organizations can view donors to their needs"
on public.givers for select to authenticated
using (public.org_has_donor_giver_profile(givers.profile_id, (select auth.uid())));
