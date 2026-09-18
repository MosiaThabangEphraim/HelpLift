-- Organizations could already edit their own impact stories (see the
-- "Organizations can update their impact stories" policy in
-- 20260914001200_mvp_extended_features.sql) but never delete them — only
-- admins had that via the blanket "FOR ALL" policy. Add the matching DELETE
-- policy scoped to the organization's own rows.

drop policy if exists "Organizations can delete their impact stories" on public.impact_stories;
create policy "Organizations can delete their impact stories"
on public.impact_stories for delete to authenticated
using (
  exists (
    select 1 from public.organizations o
    where o.id = organization_id and o.profile_id = (select auth.uid())
  )
);
