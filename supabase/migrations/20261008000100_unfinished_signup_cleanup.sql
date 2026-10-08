-- Migration: 20261008000100_unfinished_signup_cleanup.sql
-- Description: Signing up with Google, LinkedIn or Microsoft creates the
-- account the moment the person approves the provider - before they choose
-- giver/organization and finish registering. Two fixes:
--
-- 1. Every provider sign-up now starts as "registration not complete", not
--    just Google's (LinkedIn and Microsoft accounts used to skip the
--    completion step entirely). Email/password sign-ups are unaffected.
-- 2. Unfinished sign-ups are deleted automatically after 30 minutes, so the
--    email of someone who gave up half-way is not kept. Deleting the auth user
--    also removes their profile (and the empty giver/organization row) through
--    the existing ON DELETE CASCADE links. The app deletes them immediately
--    when they choose "Use a different account" / "Cancel sign-up", and also
--    runs this clean-up whenever someone signs in or registers
--    (lib/unfinished-signups.ts), so it works even without pg_cron.

-- 1. Same function as in 20260920001000_google_signup_completion.sql, but the
--    flag is false for every provider, not only Google.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, phone, role, registration_complete)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.email,
    new.raw_user_meta_data ->> 'phone',
    case
      when new.raw_user_meta_data ->> 'role' = 'organization' then 'organization'::public.app_role
      else 'giver'::public.app_role
    end,
    coalesce(new.raw_app_meta_data ->> 'provider', 'email') = 'email'
  );
  return new;
end;
$$;

-- 2. Delete sign-ups that were never finished. Only ever touches accounts whose
--    registration is still incomplete, so a finished account is never removed.
create or replace function public.delete_unfinished_signups(older_than interval default interval '30 minutes')
returns integer
language plpgsql
security definer set search_path = public, auth
as $$
declare
  removed integer;
begin
  delete from auth.users u
  using public.profiles p
  where p.id = u.id
    and p.registration_complete = false
    and u.created_at < now() - older_than;
  get diagnostics removed = row_count;
  return removed;
end;
$$;

-- Server-only (the app calls it with the service role).
revoke all on function public.delete_unfinished_signups(interval) from public, anon, authenticated;
grant execute on function public.delete_unfinished_signups(interval) to service_role;

-- Run it every 15 minutes with pg_cron where available. If pg_cron can't be
-- enabled, the migration still succeeds and the app's own clean-up covers it.
do $outer$
begin
  create extension if not exists pg_cron;
  perform cron.schedule(
    'helplift-delete-unfinished-signups',
    '*/15 * * * *',
    $job$select public.delete_unfinished_signups()$job$
  );
exception when others then
  raise notice 'pg_cron is not available (%); unfinished sign-ups are cleaned up by the app instead.', sqlerrm;
end;
$outer$;

-- Clear out any unfinished sign-ups already left behind.
select public.delete_unfinished_signups();
