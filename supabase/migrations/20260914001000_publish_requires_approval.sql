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
    where o.id = organization_id
      and o.profile_id = (select auth.uid())
      and (status <> 'open' or o.verification_status = 'approved')
  )
);