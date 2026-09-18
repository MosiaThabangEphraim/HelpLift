-- Migration: 20260914001800_fix_givers_rls_recursion.sql
-- Description: Fixes "infinite recursion detected in policy for relation givers".
--
-- Root cause: 20260914001600_messaging_and_helpers.sql's "Organizations can view
-- interested givers" policy on public.givers queries public.support_interests in
-- a correlated subquery. Reading support_interests requires Postgres to evaluate
-- ITS OWN policies, including "Givers can view their interests"
-- (20260914000300_core_needs_and_interests.sql), which queries public.givers.
-- That re-enters the very policy being evaluated — givers -> support_interests
-- -> givers -> support_interests -> ... — infinite recursion. Same failure
-- pattern as the earlier `needs` self-reference bug (20260914001500), just
-- across two tables instead of one.
--
-- Fix: move the cross-table check into a SECURITY DEFINER function, which
-- bypasses RLS entirely for its own internal queries, so evaluating it never
-- re-triggers the policies on givers/support_interests/needs/organizations in
-- the first place. Reused for both the givers SELECT policy and the
-- notifications INSERT policy that has the same join shape.

create or replace function public.org_has_interested_giver_profile(giver_profile_id uuid, org_profile_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.support_interests si
    join public.needs n on n.id = si.need_id
    join public.organizations o on o.id = n.organization_id
    join public.givers g on g.id = si.giver_id
    where g.profile_id = giver_profile_id
      and o.profile_id = org_profile_id
  );
$$;

drop policy if exists "Organizations can view interested givers" on public.givers;
create policy "Organizations can view interested givers"
on public.givers for select to authenticated
using (public.org_has_interested_giver_profile(givers.profile_id, (select auth.uid())));

drop policy if exists "Organizations can message interested givers" on public.notifications;
create policy "Organizations can message interested givers"
on public.notifications for insert to authenticated
with check (public.org_has_interested_giver_profile(recipient_id, (select auth.uid())));
