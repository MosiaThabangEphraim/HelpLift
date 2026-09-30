-- Migration: 20260928000300_login_banner.sql
-- Description: A dismissible note an admin can put on the /login page -
-- another form of announcement, alongside the existing in-app
-- announcement (which posts a notification to signed-in users/orgs) and
-- maintenance mode (which blocks the whole site). This one is for anyone
-- who lands on the login page, signed in or not, and can be dismissed.
--
-- Follows the exact same platform_settings key/value pattern as
-- maintenance_mode (see 20260924000100_platform_settings.sql) - read via
-- lib/platform-settings.ts's getLoginBanner(), edited in Platform Settings,
-- and readable by anyone (the existing "Anyone can read platform settings"
-- policy already covers this new key with no further RLS change needed -
-- the login page reads it with the anon client, same as it already reads
-- bank accounts / need categories elsewhere).
--
-- Dismissal is tracked client-side (localStorage) against this row's own
-- updated_at, not per-account - there's no session yet on the login page.
-- Editing the message later (which bumps updated_at) makes it reappear for
-- everyone who already dismissed the old one.

insert into public.platform_settings (key, value) values
  ('login_banner', '{"enabled": false, "message": ""}'::jsonb)
on conflict (key) do nothing;
