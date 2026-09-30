-- Migration: 20260926000300_support_interest_photos.sql
-- Description: A giver expressing interest in a need can now optionally
-- attach multiple photos alongside their message (e.g. photos of the goods
-- they're offering), uploaded at the same time the interest itself is
-- created (see POST /api/giver/interests). Mirrors the gift_claim_documents /
-- gift_offering_photos pattern already in place - one row per file, a
-- private storage bucket (this is a private exchange between one giver and
-- one organization, not public Gift Library content, so - unlike
-- gift-offering-photos - read access here stays authenticated-only).

create table if not exists public.support_interest_photos (
  id uuid primary key default gen_random_uuid(),
  interest_id uuid not null references public.support_interests(id) on delete cascade,
  storage_path text not null,
  file_name text,
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists support_interest_photos_interest_idx on public.support_interest_photos(interest_id);

alter table public.support_interest_photos enable row level security;

drop policy if exists "Givers can view their own interest photos" on public.support_interest_photos;
create policy "Givers can view their own interest photos"
on public.support_interest_photos for select to authenticated
using (
  exists (
    select 1 from public.support_interests si
    join public.givers g on g.id = si.giver_id
    where si.id = interest_id and g.profile_id = (select auth.uid())
  )
);

drop policy if exists "Org members can view interest photos on their needs" on public.support_interest_photos;
create policy "Org members can view interest photos on their needs"
on public.support_interest_photos for select to authenticated
using (
  exists (
    select 1 from public.support_interests si
    join public.needs n on n.id = si.need_id
    where si.id = interest_id and public.has_org_role(n.organization_id, 'viewer')
  )
);

drop policy if exists "Admins can view all interest photos" on public.support_interest_photos;
create policy "Admins can view all interest photos"
on public.support_interest_photos for select to authenticated
using (public.is_admin());

drop policy if exists "Givers can add photos to their own interest" on public.support_interest_photos;
create policy "Givers can add photos to their own interest"
on public.support_interest_photos for insert to authenticated
with check (
  uploaded_by = (select auth.uid())
  and exists (
    select 1 from public.support_interests si
    join public.givers g on g.id = si.giver_id
    where si.id = interest_id and g.profile_id = (select auth.uid())
  )
);

-- Storage bucket. Private (this is a one-to-one exchange, not a public
-- listing) - any authenticated user may read, same as gift-claim-documents /
-- organization-documents; the app only ever hands out a signed URL to the
-- giver who sent it or the org that received it.
insert into storage.buckets (id, name, public)
values ('support-interest-photos', 'support-interest-photos', false)
on conflict (id) do update set public = false;

drop policy if exists "Authenticated users can upload interest photos" on storage.objects;
create policy "Authenticated users can upload interest photos"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'support-interest-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Authenticated users can read interest photos" on storage.objects;
create policy "Authenticated users can read interest photos"
on storage.objects for select to authenticated
using (bucket_id = 'support-interest-photos');
