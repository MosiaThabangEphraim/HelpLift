-- Migration: 20260914002200_notifications_and_diagnostics.sql
-- Description:
--   1. A one-time diagnostic function so a live policy definition can actually
--      be inspected (via the service-role key) instead of guessing further —
--      "Message Admin" has been reported broken twice despite the policy
--      looking correct on paper and its RPC dependencies checking out.
--   2. Belt-and-braces explicit execute grant on is_admin_profile — every
--      other helper function it's used alongside either has one or is proven
--      working without one, so this is unlikely to be the fix, but it's free.
--   3. Lets a giver notify the organization on their side of a fulfillment
--      (marking in progress / delivered) — the reverse direction (org ->
--      giver) was already covered by the existing interested-givers policy,
--      but nothing let a giver message an org back.
--   4. General giver -> organization messaging, not just fulfillment-linked
--      pairs. Organizations are public entities (listed on the needs board
--      and their own /organizations/[id] page), so a giver messaging one they
--      haven't interacted with yet is safe. The reverse (org -> any giver) is
--      intentionally left scoped to relationships the org can already see
--      (interested givers, donors, fulfillments) rather than opened up to a
--      full giver directory, which doesn't exist for privacy reasons.

create or replace function public.debug_list_policies(target_table text)
returns table (policyname text, cmd text, permissive text, roles name[], qual text, with_check text)
language sql
security definer
set search_path = public, pg_catalog
stable
as $$
  select policyname, cmd, permissive, roles, qual, with_check
  from pg_policies
  where schemaname = 'public' and tablename = target_table;
$$;
grant execute on function public.debug_list_policies(text) to authenticated, service_role;

grant execute on function public.is_admin_profile(uuid) to authenticated;

create or replace function public.giver_has_fulfillment_with_org(giver_profile_id uuid, org_profile_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.fulfillments f
    join public.givers g on g.id = f.giver_id
    join public.organizations o on o.id = f.organization_id
    where g.profile_id = giver_profile_id
      and o.profile_id = org_profile_id
  );
$$;

drop policy if exists "Givers can notify organizations for their fulfillments" on public.notifications;
create policy "Givers can notify organizations for their fulfillments"
on public.notifications for insert to authenticated
with check (public.giver_has_fulfillment_with_org((select auth.uid()), recipient_id));

drop policy if exists "Givers can message any organization" on public.notifications;
create policy "Givers can message any organization"
on public.notifications for insert to authenticated
with check (
  exists (select 1 from public.givers g where g.profile_id = (select auth.uid()))
  and exists (select 1 from public.organizations o where o.profile_id = recipient_id)
);
