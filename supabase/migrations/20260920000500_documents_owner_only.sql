-- Migration: 20260920000500_documents_owner_only.sql
-- Description: Only organization owners may upload verification documents.
-- Replaces the manager-level insert policy from
-- 20260920000100_organization_team_roles.sql. Managers and viewers can still
-- read the organization's documents.

drop policy if exists "Managers can add organization documents" on public.organization_documents;
drop policy if exists "Owners can add organization documents" on public.organization_documents;
create policy "Owners can add organization documents"
on public.organization_documents for insert to authenticated
with check (uploaded_by = (select auth.uid()) and public.has_org_role(organization_id, 'owner'));
