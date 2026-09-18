-- Closes two gaps in the Main Admin spec:
--   1. Organization Approval: there was no audit trail of verification
--      decisions (approve/reject/request-info/resubmit) — only the current
--      status + last note survived on the organizations row itself.
--   2. Monitoring and Reporting: needs an index on needs.status so the new
--      "fulfilled needs" / date-range reporting queries stay fast as the
--      needs table grows.

create table if not exists public.organization_verification_history (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  previous_status public.verification_status,
  new_status public.verification_status not null,
  notes text,
  changed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists organization_verification_history_org_id_idx
  on public.organization_verification_history(organization_id);

alter table public.organization_verification_history enable row level security;

drop policy if exists "Admins can view all verification history" on public.organization_verification_history;
create policy "Admins can view all verification history"
on public.organization_verification_history for select to authenticated
using (public.is_admin());

drop policy if exists "Organizations can view their own verification history" on public.organization_verification_history;
create policy "Organizations can view their own verification history"
on public.organization_verification_history for select to authenticated
using (exists (
  select 1 from public.organizations o
  where o.id = organization_id and o.profile_id = (select auth.uid())
));

-- No insert/update/delete policy for authenticated/anon: rows are only ever
-- written by the trigger below, which runs as a security-definer function
-- (so it bypasses RLS the same way handle_new_profile already does).
create or replace function public.log_organization_verification_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.verification_status is distinct from old.verification_status then
    insert into public.organization_verification_history (
      organization_id, previous_status, new_status, notes, changed_by
    ) values (
      new.id, old.verification_status, new.verification_status, new.verification_notes, auth.uid()
    );
  end if;
  return new;
end;
$$;

drop trigger if exists organizations_log_verification_history on public.organizations;
create trigger organizations_log_verification_history
after update on public.organizations
for each row execute function public.log_organization_verification_change();

create index if not exists needs_status_idx on public.needs(status);
