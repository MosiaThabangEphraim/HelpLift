-- Migration: 20260930000700_admin_two_factor_exempt.sql
-- Description: api/login now has a role !== "admin" check before honoring
-- profiles.two_factor_enabled, but that's app code - anyone still running
-- an older copy of the app only reads the column unconditionally and would
-- still prompt an admin for an emailed code. This closes the gap at the
-- database level instead: admin rows are forced to two_factor_enabled =
-- false, so even old app code skips 2FA correctly for them, since the
-- condition itself is false regardless of whether that code knows about
-- the role exemption.

update public.profiles set two_factor_enabled = false where role = 'admin';

-- Keeps it false going forward too - a new admin signup, a promotion to
-- admin, or a direct attempt to flip it back on for an admin row all land
-- here, since this fires on every insert/update regardless of caller.
create or replace function public.enforce_admin_two_factor_exempt()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role = 'admin' then
    new.two_factor_enabled = false;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_enforce_admin_two_factor_exempt on public.profiles;
create trigger profiles_enforce_admin_two_factor_exempt
before insert or update on public.profiles
for each row execute function public.enforce_admin_two_factor_exempt();
