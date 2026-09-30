-- Migration: 20260925000300_withdrawals_owner_only.sql
-- Description: Requesting a withdrawal now requires the 'owner' role, not
-- just 'manager' - managers and viewers can still see the wallet and the
-- withdrawal history, and managers can still cancel a pending request (that
-- policy is unchanged), but only an owner may create one. Mirrors the
-- app-side check in app/api/organization/withdrawals/route.ts.

drop policy if exists "Managers can request a withdrawal" on public.organization_withdrawals;
drop policy if exists "Owners can request a withdrawal" on public.organization_withdrawals;
create policy "Owners can request a withdrawal"
on public.organization_withdrawals for insert to authenticated
with check (
  status = 'pending'
  and requested_by = (select auth.uid())
  and public.has_org_role(organization_id, 'owner')
  and exists (select 1 from public.organizations o where o.id = organization_id and o.verification_status = 'approved')
);
