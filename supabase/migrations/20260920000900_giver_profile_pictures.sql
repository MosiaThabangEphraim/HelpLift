-- Migration: 20260920000900_giver_profile_pictures.sql
-- Description: Givers can have a profile picture, like organizations have a
-- logo. The picture's public URL is stored on givers.avatar_url; the file
-- lives in a public storage bucket, under a folder named after the giver's user
-- id (the same layout the organization-branding bucket uses).
--
-- Organizations can already read the givers they deal with (interests, donations,
-- fulfillments), so they see avatar_url with everything else on the giver's row.

alter table public.givers add column if not exists avatar_url text;

insert into storage.buckets (id, name, public)
values ('profile-pictures', 'profile-pictures', true)
on conflict (id) do update set public = true;

drop policy if exists "Public can view profile pictures" on storage.objects;
create policy "Public can view profile pictures"
on storage.objects for select
using (bucket_id = 'profile-pictures');

drop policy if exists "Users can upload their own profile picture" on storage.objects;
create policy "Users can upload their own profile picture"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'profile-pictures'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Users can delete their own profile picture" on storage.objects;
create policy "Users can delete their own profile picture"
on storage.objects for delete to authenticated
using (
  bucket_id = 'profile-pictures'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
