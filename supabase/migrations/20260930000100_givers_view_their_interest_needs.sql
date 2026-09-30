-- Migration: 20260930000100_givers_view_their_interest_needs.sql
-- Description: Fixes a giver losing visibility into a need's own title/details
-- the moment their interest is accepted.
--
-- public.needs' only general-audience read policy is "Anyone can view open
-- needs" (status = 'open') - see 20260914000300_core_needs_and_interests.sql.
-- Accepting an interest moves the need to 'in_progress' (see
-- api/organization/interests/[id]/route.ts), so a giver's own session can no
-- longer read that row through RLS at all, even though they have a live
-- interest tied to it. The client-side join then comes back null and the UI
-- falls back to a bare "Need" placeholder.
--
-- This adds one more permissive read policy (Postgres ORs these together,
-- same pattern as "Organizations can view their needs") so a giver can also
-- see a need if they have a support_interests row against it, regardless of
-- the need's current status. public.fulfillments has no need_id of its own -
-- every fulfillment requires a support_interests row (interest_id is not
-- null, unique, on delete cascade), so that row alone already covers a
-- fulfillment too; no separate fulfillments check is needed.

drop policy if exists "Givers can view needs they have an interest in" on public.needs;
create policy "Givers can view needs they have an interest in"
on public.needs for select to authenticated
using (
  exists (
    select 1
    from public.support_interests si
    join public.givers g on g.id = si.giver_id
    where si.need_id = needs.id and g.profile_id = (select auth.uid())
  )
);
