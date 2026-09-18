-- Migration: 20260914001300_need_admin_approval_lock.sql
-- Description: Prevent organizations from directly publishing needs to 'open'.
-- Only administrators (via public.is_admin() policy) may transition a need from draft -> open.
-- Organizations may still close/fulfill their own live needs, edit open need details,
-- and may edit their draft content.

drop policy if exists "Organizations can update their needs" on public.needs;
create policy "Organizations can update their needs"
on public.needs for update to authenticated
using (exists (
  select 1 from public.organizations o
  where o.id = organization_id and o.profile_id = (select auth.uid())
))
with check (
  exists (
    select 1 from public.organizations o
    where o.id = organization_id and o.profile_id = (select auth.uid())
  )
  and (
    status <> 'open'
    or exists (
      select 1 from public.needs existing
      where existing.id = id and existing.status = 'open'
    )
  )
);
