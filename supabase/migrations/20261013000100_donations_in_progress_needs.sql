-- Migration: 20261013000100_donations_in_progress_needs.sql
-- Description: Givers can donate money to a need that is "in progress", not
-- only "open". A need moves to in_progress once an offer of help is accepted,
-- and the donation API already allows both states - but the insert policy, as
-- last rewritten in 20260926000400_platform_donations.sql, only allowed
-- status = 'open', so donating after expressing interest failed with
-- "new row violates row-level security policy for table donations".
-- (20260914002900_org_scope_completion_part2.sql had allowed both; the
-- platform-donations rewrite narrowed it by mistake.) Same policy otherwise.

drop policy if exists "Givers can create their own donations" on public.donations;
create policy "Givers can create their own donations"
on public.donations for insert to authenticated
with check (
  (
    giver_id is not null
    and exists (select 1 from public.givers g where g.id = giver_id and g.profile_id = (select auth.uid()))
    and (
      -- Donation toward a specific need's monetary target.
      (
        need_id is not null and organization_id is not null and gift_offering_id is null and is_platform_donation = false
        and exists (
          select 1 from public.needs n
          where n.id = need_id and n.organization_id = donations.organization_id and n.status in ('open', 'in_progress')
        )
      )
      or
      -- General financial pledge from the Gift Library, not yet tied to a need/org.
      (
        need_id is null and organization_id is null and gift_offering_id is not null and is_platform_donation = false
        and exists (
          select 1 from public.gift_offerings go
          join public.givers g2 on g2.id = go.giver_id
          where go.id = gift_offering_id
            and g2.profile_id = (select auth.uid())
            and go.status = 'pending'
        )
      )
    )
  )
  or
  -- Direct support for the platform itself - no need, org, or gift offering,
  -- and identified by profile rather than a giver row (a giver or an
  -- organization manager/owner may both do this).
  (
    giver_id is null
    and need_id is null and organization_id is null and gift_offering_id is null and is_platform_donation = true
    and donor_profile_id = (select auth.uid())
    and exists (
      select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('giver', 'organization')
    )
  )
);
