-- Migration: 20260926000200_gift_offering_photos.sql
-- Description: A giver pledging a goods/services Gift Library offering can
-- now optionally attach multiple photos, uploaded at the same time the
-- offering itself is created (see POST /api/giver/gifts). Mirrors the
-- gift_claim_documents / fulfillment_proofs pattern already in place -
-- one row per file, a private storage bucket, signed URLs handed out by the
-- app.

create table if not exists public.gift_offering_photos (
  id uuid primary key default gen_random_uuid(),
  gift_offering_id uuid not null references public.gift_offerings(id) on delete cascade,
  storage_path text not null,
  file_name text,
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists gift_offering_photos_offering_idx on public.gift_offering_photos(gift_offering_id);

alter table public.gift_offering_photos enable row level security;

-- The Gift Library is a public, browsable listing - once an offering is
-- published (approved) or already claimed, its photos are just as public as
-- its description already is. This policy has no `to authenticated`, so it
-- also covers anonymous visitors on the public /gift-library page.
drop policy if exists "Anyone can view photos of published offerings" on public.gift_offering_photos;
create policy "Anyone can view photos of published offerings"
on public.gift_offering_photos for select
using (
  exists (
    select 1 from public.gift_offerings go
    where go.id = gift_offering_id and go.status in ('approved', 'claimed')
  )
);

drop policy if exists "Givers can view their own offering photos" on public.gift_offering_photos;
create policy "Givers can view their own offering photos"
on public.gift_offering_photos for select to authenticated
using (
  exists (
    select 1 from public.gift_offerings go
    join public.givers g on g.id = go.giver_id
    where go.id = gift_offering_id and g.profile_id = (select auth.uid())
  )
);

drop policy if exists "Admins can view all gift offering photos" on public.gift_offering_photos;
create policy "Admins can view all gift offering photos"
on public.gift_offering_photos for select to authenticated
using (public.is_admin());

drop policy if exists "Givers can add photos to their own offerings" on public.gift_offering_photos;
create policy "Givers can add photos to their own offerings"
on public.gift_offering_photos for insert to authenticated
with check (
  uploaded_by = (select auth.uid())
  and exists (
    select 1 from public.gift_offerings go
    join public.givers g on g.id = go.giver_id
    where go.id = gift_offering_id and g.profile_id = (select auth.uid())
  )
);

-- Storage bucket. Public listing photos, so read is open to anyone (the
-- public Gift Library page has no session); write is restricted to the
-- uploader's own folder, same convention as every other upload bucket here.
insert into storage.buckets (id, name, public)
values ('gift-offering-photos', 'gift-offering-photos', false)
on conflict (id) do update set public = false;

drop policy if exists "Authenticated users can upload gift offering photos" on storage.objects;
create policy "Authenticated users can upload gift offering photos"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'gift-offering-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Anyone can read gift offering photos" on storage.objects;
create policy "Anyone can read gift offering photos"
on storage.objects for select
using (bucket_id = 'gift-offering-photos');
