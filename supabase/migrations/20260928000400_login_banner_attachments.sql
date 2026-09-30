-- Migration: 20260928000400_login_banner_attachments.sql
-- Description: Lets an announcement's login-page banner (see
-- 20260928000300_login_banner.sql) carry documents/pictures too, not just
-- text - shown to anyone who lands on /login, signed in or not. Unlike the
-- in-app notification's attachments (message-attachments, a private bucket
-- gated to the recipient), a banner attachment must be fetchable by a
-- visitor with no session at all, so it needs its own PUBLIC bucket -
-- same pattern as need-attachments (20260914002900_org_scope_completion_part2.sql),
-- just scoped to admin uploads instead of an organization's own.
--
-- login_banner's platform_settings value gains an "attachments" array
-- ({path, name}[]); see lib/platform-settings.ts's LoginBanner type and
-- app/api/admin/announcements/route.ts for how it's populated.

insert into storage.buckets (id, name, public)
values ('login-banner-attachments', 'login-banner-attachments', true)
on conflict (id) do update set public = true;

drop policy if exists "Public can view login banner attachments" on storage.objects;
create policy "Public can view login banner attachments"
on storage.objects for select
using (bucket_id = 'login-banner-attachments');

drop policy if exists "Admins can upload login banner attachments" on storage.objects;
create policy "Admins can upload login banner attachments"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'login-banner-attachments'
  and public.is_admin()
);

drop policy if exists "Admins can delete login banner attachments" on storage.objects;
create policy "Admins can delete login banner attachments"
on storage.objects for delete to authenticated
using (
  bucket_id = 'login-banner-attachments'
  and public.is_admin()
);
