-- Migration: 20260930000200_fix_needs_interest_policy_recursion.sql
-- Description: Fixes "infinite recursion detected in policy for relation
-- needs", introduced by 20260930000100_givers_view_their_interest_needs.sql.
--
-- That policy's EXISTS subquery reads public.support_interests directly.
-- support_interests has its own policy, "Organizations can view interests
-- for their needs" (20260914000300_core_needs_and_interests.sql), whose
-- subquery reads public.needs. Postgres re-applies each table's RLS
-- policies for every nested read of that table, even inside another
-- policy's subquery - so evaluating the needs policy required evaluating
-- the support_interests policy, which required evaluating the needs policy
-- again, forever.
--
-- The fix is the same one already used elsewhere in this schema
-- (has_org_role(), need_organization_id(), etc.): move the check into a
-- security definer function. A security definer function runs with its
-- owner's privileges, so its own internal queries aren't subject to RLS at
-- all - nothing left to recurse into.

create or replace function public.giver_has_interest_in_need(p_need_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.support_interests si
    join public.givers g on g.id = si.giver_id
    where si.need_id = p_need_id and g.profile_id = (select auth.uid())
  );
$$;
grant execute on function public.giver_has_interest_in_need(uuid) to authenticated;

drop policy if exists "Givers can view needs they have an interest in" on public.needs;
create policy "Givers can view needs they have an interest in"
on public.needs for select to authenticated
using (public.giver_has_interest_in_need(needs.id));
