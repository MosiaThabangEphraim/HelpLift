insert into storage.buckets (id, name, public)
values ('organization-documents', 'organization-documents', false)
on conflict (id) do update set public = false;

create table if not exists public.organization_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  uploaded_by uuid not null references auth.users(id) on delete cascade,
  file_name text not null,
  storage_path text not null unique,
  document_type text not null default 'supporting_document',
  created_at timestamptz not null default now()
);

alter table public.organization_documents enable row level security;

drop policy if exists "Organizations can view their documents" on public.organization_documents;
create policy "Organizations can view their documents"
on public.organization_documents for select to authenticated
using (exists (
  select 1 from public.organizations o
  where o.id = organization_id and o.profile_id = (select auth.uid())
));

drop policy if exists "Organizations can create their documents" on public.organization_documents;
create policy "Organizations can create their documents"
on public.organization_documents for insert to authenticated
with check (
  uploaded_by = (select auth.uid())
  and exists (
    select 1 from public.organizations o
    where o.id = organization_id and o.profile_id = (select auth.uid())
  )
);

drop policy if exists "Admins can view all documents" on public.organization_documents;
create policy "Admins can view all documents"
on public.organization_documents for select to authenticated
using (public.is_admin());

drop policy if exists "Authenticated users can upload organization documents" on storage.objects;
create policy "Authenticated users can upload organization documents"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'organization-documents'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Owners and admins can read organization documents" on storage.objects;
create policy "Owners and admins can read organization documents"
on storage.objects for select to authenticated
using (
  bucket_id = 'organization-documents'
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or public.is_admin()
  )
);

drop policy if exists "Owners can delete organization documents" on storage.objects;
create policy "Owners can delete organization documents"
on storage.objects for delete to authenticated
using (
  bucket_id = 'organization-documents'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
