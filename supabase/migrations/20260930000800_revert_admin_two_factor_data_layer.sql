-- Migration: 20260930000800_revert_admin_two_factor_data_layer.sql
-- Description: Reverts 20260930000700_admin_two_factor_exempt.sql - the
-- admin 2FA exemption is handled in app code only now (api/login's
-- `profile.two_factor_enabled && profile.role !== "admin"` check), not at
-- the database layer. Drops the trigger that forced two_factor_enabled to
-- false on every admin row, and restores it to true so the column reflects
-- the normal default again - otherwise an admin later demoted to another
-- role would silently end up with 2FA stuck off, left over from the old
-- forced backfill, instead of back to the usual default.

drop trigger if exists profiles_enforce_admin_two_factor_exempt on public.profiles;
drop function if exists public.enforce_admin_two_factor_exempt();

update public.profiles set two_factor_enabled = true where role = 'admin';
