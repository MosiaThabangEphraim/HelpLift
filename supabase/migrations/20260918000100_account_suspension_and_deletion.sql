-- Migration: 20260918000100_account_suspension_and_deletion.sql
-- Description: Adds account suspension (profiles.suspended) so admins can
-- lock a user/organization out of the app while keeping their data intact,
-- pending a decision to restore or delete them.
--
-- Account deletion itself needs no schema change: profiles.id references
-- auth.users(id) on delete cascade, and organizations.profile_id /
-- givers.profile_id reference profiles(id) on delete cascade, which cascades
-- further into needs, donations, gift_offerings, notifications, etc. — all
-- already FK'd with on delete cascade. Deleting the auth.users row (via
-- supabase.auth.admin.deleteUser(), which api/admin/users/[id] and the new
-- self-service endpoint both use) wipes everything in one call.

alter table public.profiles add column if not exists suspended boolean not null default false;
alter table public.profiles add column if not exists suspended_at timestamptz;
alter table public.profiles add column if not exists suspended_reason text;

-- "Users can update their own profile" (20260914000100) is a blanket
-- using/with-check on id = auth.uid() with no column-level restriction —
-- meaning, before this, a user could already self-promote their own role
-- via a direct client call (RLS has no concept of "this column is
-- read-only for non-admins"). Adding `suspended` under that same policy
-- would let a suspended user simply unsuspend themselves the same way.
-- RLS can't compare OLD vs NEW column values on its own, so a trigger
-- (matching the prevent_donation_tamper() pattern already used elsewhere)
-- is what actually closes both holes.
create or replace function public.prevent_profile_privilege_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() then
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

drop trigger if exists profiles_prevent_privilege_escalation on public.profiles;
create trigger profiles_prevent_privilege_escalation
before update on public.profiles
for each row execute function public.prevent_profile_privilege_escalation();
