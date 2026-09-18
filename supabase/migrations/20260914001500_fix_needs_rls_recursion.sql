-- Migration: 20260914001500_fix_needs_rls_recursion.sql
-- Description: Fixes "infinite recursion detected in policy for relation needs",
-- hit by admins approving/publishing a need (any UPDATE on public.needs).
--
-- Root cause: 20260914001300_need_admin_approval_lock.sql's "Organizations can
-- update their needs" policy included a WITH CHECK subquery that reads from
-- public.needs itself (`select 1 from public.needs existing where existing.id = id...`)
-- in order to compare the row's old status against its new status. Evaluating
-- that subquery requires Postgres to re-apply RLS to public.needs, which
-- re-evaluates this same policy — infinite recursion. This affected every
-- UPDATE on needs, including the admin's own "Approve & Publish" action,
-- because Postgres must resolve the combined WITH CHECK expression across all
-- permissive policies for the command, not just the one branch that happens
-- to apply to the current role.
--
-- Fix: drop the self-referencing subquery from the RLS policy (organizations
-- may update only their own needs, full stop — no status logic in RLS), and
-- move the "only admins may transition a need from draft to open" rule into a
-- BEFORE UPDATE trigger, which has direct, non-recursive access to OLD/NEW.
-- This preserves the intended behavior from 20260914001300 (organizations
-- cannot self-publish; only administrators can move a need to 'open', per the
-- functional spec's need-verification requirement) without the recursion.

drop policy if exists "Organizations can update their needs" on public.needs;
create policy "Organizations can update their needs"
on public.needs for update to authenticated
using (
  exists (
    select 1 from public.organizations o
    where o.id = organization_id and o.profile_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.organizations o
    where o.id = organization_id and o.profile_id = (select auth.uid())
  )
);

create or replace function public.enforce_need_publish_rule()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.status = 'open' and old.status <> 'open' and not public.is_admin() then
    raise exception 'Only administrators can publish a need (transition it to open).';
  end if;
  return new;
end;
$$;

drop trigger if exists needs_enforce_publish_rule on public.needs;
create trigger needs_enforce_publish_rule
before update on public.needs
for each row
execute function public.enforce_need_publish_rule();
