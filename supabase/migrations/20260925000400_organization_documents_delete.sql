-- Migration: 20260925000400_organization_documents_delete.sql
-- Description: Organizations can now delete a previously uploaded
-- verification document - restricted to owners (same role required to
-- upload one, per 20260920000500_documents_owner_only.sql). Any owner may
-- delete a document uploaded by any teammate, not just their own upload.
--
-- The original storage delete policy (20260914000600_organization_documents.sql)
-- only let the uploader delete their own file (folder = uploader's own uid).
-- That's too narrow now - replaced with the same "any owner of the same org
-- as the uploader" join used by the teammate-read policy
-- (20260920000100_organization_team_roles.sql).

drop policy if exists "Owners can delete organization documents" on public.organization_documents;
create policy "Owners can delete organization documents"
on public.organization_documents for delete to authenticated
using (public.has_org_role(organization_id, 'owner'));

drop policy if exists "Owners can delete organization documents" on storage.objects;
create policy "Owners can delete organization documents"
on storage.objects for delete to authenticated
using (
  bucket_id = 'organization-documents'
  and exists (
    select 1 from public.organization_members mine
    join public.organization_members theirs on theirs.organization_id = mine.organization_id
    where mine.profile_id = (select auth.uid())
      and mine.role = 'owner'
      and theirs.profile_id::text = (storage.foldername(name))[1]
  )
);
