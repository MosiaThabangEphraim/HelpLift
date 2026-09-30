-- Migration: 20260923000200_organization_withdrawals.sql
-- Description: An organization's wallet - money HelpLift has received on
-- their behalf (confirmed donations toward their needs, plus financial Gift
-- Library pledges once claimed - see 20260923000100) sits in HelpLift's own
-- bank accounts (lib/banking.ts BANK_ACCOUNTS) until the organization
-- requests a withdrawal:
--
--   organization requests a withdrawal (amount <= available balance)
--     -> pending
--   an admin reviews it
--     -> approved (org notified; the accountant then does the real EFT out
--        of HelpLift's account into the organization's own bank details)
--        or
--     -> rejected (org notified, with an optional reason)
--   once the accountant has actually sent the money, an admin attaches
--   proof of payment
--     -> paid ("Transfer Complete"; org notified, proof attached)
--
-- An organization may also cancel its own request while it's still pending
-- (e.g. they made a mistake), without needing an admin to reject it.
--
-- The available balance itself is computed in application code (organization
-- confirmed donations minus withdrawals not rejected/cancelled), not stored
-- here - same approach as every other running total in this app (analytics,
-- CSV exports), so there's one source of truth (the donations/withdrawals
-- rows) and nothing to keep in sync.

create table if not exists public.organization_withdrawals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'paid', 'cancelled')),
  requested_by uuid references public.profiles(id) on delete set null,
  rejection_reason text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  proof_storage_path text,
  proof_file_name text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists organization_withdrawals_org_idx on public.organization_withdrawals(organization_id);

drop trigger if exists organization_withdrawals_set_updated_at on public.organization_withdrawals;
create trigger organization_withdrawals_set_updated_at before update on public.organization_withdrawals
for each row execute function public.set_updated_at();

alter table public.organization_withdrawals enable row level security;

drop policy if exists "Org members can view their withdrawals" on public.organization_withdrawals;
create policy "Org members can view their withdrawals"
on public.organization_withdrawals for select to authenticated
using (public.has_org_role(organization_id, 'viewer') or public.is_admin());

drop policy if exists "Managers can request a withdrawal" on public.organization_withdrawals;
create policy "Managers can request a withdrawal"
on public.organization_withdrawals for insert to authenticated
with check (
  status = 'pending'
  and requested_by = (select auth.uid())
  and public.has_org_role(organization_id, 'manager')
  and exists (select 1 from public.organizations o where o.id = organization_id and o.verification_status = 'approved')
);

-- Two separate UPDATE policies (one per actor) so each can be as narrow as
-- possible; prevent_withdrawal_tamper() below enforces exactly which columns
-- each may touch, the same pattern as prevent_donation_tamper().
drop policy if exists "Managers can cancel a pending withdrawal" on public.organization_withdrawals;
create policy "Managers can cancel a pending withdrawal"
on public.organization_withdrawals for update to authenticated
using (public.has_org_role(organization_id, 'manager') and status = 'pending')
with check (public.has_org_role(organization_id, 'manager'));

drop policy if exists "Admins can review withdrawals" on public.organization_withdrawals;
create policy "Admins can review withdrawals"
on public.organization_withdrawals for update to authenticated
using (public.is_admin())
with check (public.is_admin());

create or replace function public.prevent_withdrawal_tamper()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() then
    if new.amount <> old.amount
      or new.organization_id <> old.organization_id
      or new.requested_by is distinct from old.requested_by
      or new.created_at <> old.created_at
    then
      raise exception 'Admins may only update review fields (status, rejection_reason, proof, paid_at).';
    end if;
  else
    -- An organization member may only cancel their own still-pending
    -- request - nothing else about the row may change.
    if old.status <> 'pending' or new.status <> 'cancelled' then
      raise exception 'You may only cancel a withdrawal that is still pending.';
    end if;
    if new.amount <> old.amount
      or new.organization_id <> old.organization_id
      or new.requested_by is distinct from old.requested_by
      or coalesce(new.rejection_reason, '') <> coalesce(old.rejection_reason, '')
      or new.reviewed_by is distinct from old.reviewed_by
      or new.reviewed_at is distinct from old.reviewed_at
      or coalesce(new.proof_storage_path, '') <> coalesce(old.proof_storage_path, '')
      or coalesce(new.proof_file_name, '') <> coalesce(old.proof_file_name, '')
      or new.paid_at is distinct from old.paid_at
    then
      raise exception 'You may only cancel this withdrawal, not change its other fields.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists organization_withdrawals_tamper_guard on public.organization_withdrawals;
create trigger organization_withdrawals_tamper_guard
before update on public.organization_withdrawals
for each row execute function public.prevent_withdrawal_tamper();

-- Storage bucket for proof-of-payment uploads (private; mirrors the
-- donation-proofs / fulfillment-proofs pattern already in place). Admins
-- upload under their own uid folder; any authenticated user may read (the
-- app only ever hands out a signed URL to the organization or an admin).
insert into storage.buckets (id, name, public)
values ('withdrawal-proofs', 'withdrawal-proofs', false)
on conflict (id) do update set public = false;

drop policy if exists "Authenticated users can upload withdrawal proofs" on storage.objects;
create policy "Authenticated users can upload withdrawal proofs"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'withdrawal-proofs'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Authenticated users can read withdrawal proofs" on storage.objects;
create policy "Authenticated users can read withdrawal proofs"
on storage.objects for select to authenticated
using (bucket_id = 'withdrawal-proofs');
