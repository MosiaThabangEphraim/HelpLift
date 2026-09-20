-- Migration: 20260920001100_google_org_signup.sql
-- Description: Organizations can also sign up with Google. Google only verifies
-- the email; the person still completes the full organization registration.
--
-- A new Google account is created as a giver (the database can't know they
-- meant to register an organization). The Google callback converts it to an
-- organization account, on the server, using the service role. That changes
-- profiles.role, which prevent_profile_privilege_escalation() forbids for
-- everyone except admins, and the service role has no auth.uid(), so it counted
-- as "not an admin" too.
--
-- Fix: treat a call with no signed-in user (auth.uid() is null: the service role
-- or the SQL editor, never a browser or API user) like the admin case, the same
-- reasoning used for prevent_donation_tamper() in
-- 20260917000100_payfast_itn_trigger.sql. Signed-in users are still blocked from
-- changing their own role or suspension.

create or replace function public.prevent_profile_privilege_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() or auth.uid() is null then
    return new;
  end if;
  if new.role <> old.role
    or new.suspended <> old.suspended
    or coalesce(new.suspended_reason, '') <> coalesce(old.suspended_reason, '')
    or new.suspended_at is distinct from old.suspended_at
  then
    raise exception 'You may not change your own role or suspension status.';
  end if;
  return new;
end;
$$;
