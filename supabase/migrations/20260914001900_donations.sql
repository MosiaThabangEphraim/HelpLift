-- Migration: 20260914001900_donations.sql
-- Description: Monetary donations against a need. Two payment methods:
--   'eft'     - manual bank transfer, implemented end-to-end here (pending ->
--               giver uploads proof of payment -> admin approves/rejects).
--   'payfast' - automated gateway, wired into the status model now but the
--               actual PayFast integration/webhook is a follow-up; rows of
--               this method just stay 'pending' until that lands.

do $$ begin
  create type public.donation_method as enum ('eft', 'payfast');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.donation_status as enum ('pending', 'successful', 'unsuccessful');
exception when duplicate_object then null;
end $$;

create table if not exists public.donations (
  id uuid primary key default gen_random_uuid(),
  need_id uuid not null references public.needs(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  giver_id uuid not null references public.givers(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  payment_method public.donation_method not null default 'eft',
  status public.donation_status not null default 'pending',
  reference_code text not null unique default ('HL-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))),
  bank_name text check (bank_name in ('absa', 'fnb')),
  proof_storage_path text,
  proof_uploaded_at timestamptz,
  payer_notes text,
  payfast_payment_id text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists donations_need_id_idx on public.donations(need_id);
create index if not exists donations_organization_id_idx on public.donations(organization_id);
create index if not exists donations_giver_id_idx on public.donations(giver_id);

drop trigger if exists donations_set_updated_at on public.donations;
create trigger donations_set_updated_at before update on public.donations
for each row execute function public.set_updated_at();

-- Field-level tamper guard (RLS can gate rows, not columns):
--   - A non-admin may only ever attach proof of payment to their own still-
--     pending donation (proof_storage_path / proof_uploaded_at / payer_notes),
--     and can never touch the money/status fields.
--   - An admin may only change the review fields (status / reviewed_by /
--     reviewed_at / admin_notes), and can never touch the giver's submitted
--     amount, method, bank choice, or proof.
create or replace function public.prevent_donation_tamper()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() then
    if new.amount <> old.amount
      or new.need_id <> old.need_id
      or new.organization_id <> old.organization_id
      or new.giver_id <> old.giver_id
      or new.payment_method <> old.payment_method
      or coalesce(new.reference_code, '') <> coalesce(old.reference_code, '')
      or coalesce(new.bank_name, '') <> coalesce(old.bank_name, '')
      or coalesce(new.proof_storage_path, '') <> coalesce(old.proof_storage_path, '')
    then
      raise exception 'Admins may only update donation review fields';
    end if;
  else
    if old.status <> 'pending' then
      raise exception 'This donation has already been reviewed';
    end if;
    if new.amount <> old.amount
      or new.need_id <> old.need_id
      or new.organization_id <> old.organization_id
      or new.giver_id <> old.giver_id
      or new.payment_method <> old.payment_method
      or new.status <> old.status
      or coalesce(new.reference_code, '') <> coalesce(old.reference_code, '')
      or coalesce(new.bank_name, '') <> coalesce(old.bank_name, '')
      or new.reviewed_by is distinct from old.reviewed_by
      or new.reviewed_at is distinct from old.reviewed_at
      or coalesce(new.admin_notes, '') <> coalesce(old.admin_notes, '')
    then
      raise exception 'You may only attach proof of payment to your donation';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists donations_prevent_tamper on public.donations;
create trigger donations_prevent_tamper
before update on public.donations
for each row execute function public.prevent_donation_tamper();

alter table public.donations enable row level security;

drop policy if exists "Givers can view their own donations" on public.donations;
create policy "Givers can view their own donations"
on public.donations for select to authenticated
using (exists (
  select 1 from public.givers g where g.id = giver_id and g.profile_id = (select auth.uid())
));

drop policy if exists "Givers can create their own donations" on public.donations;
create policy "Givers can create their own donations"
on public.donations for insert to authenticated
with check (
  exists (select 1 from public.givers g where g.id = giver_id and g.profile_id = (select auth.uid()))
  and exists (
    select 1 from public.needs n
    where n.id = need_id and n.organization_id = donations.organization_id and n.status = 'open'
  )
);

drop policy if exists "Givers can update their own pending donations" on public.donations;
create policy "Givers can update their own pending donations"
on public.donations for update to authenticated
using (exists (
  select 1 from public.givers g where g.id = giver_id and g.profile_id = (select auth.uid())
))
with check (exists (
  select 1 from public.givers g where g.id = giver_id and g.profile_id = (select auth.uid())
));

drop policy if exists "Organizations can view donations to their needs" on public.donations;
create policy "Organizations can view donations to their needs"
on public.donations for select to authenticated
using (exists (
  select 1 from public.organizations o where o.id = organization_id and o.profile_id = (select auth.uid())
));

drop policy if exists "Admins can view all donations" on public.donations;
create policy "Admins can view all donations"
on public.donations for select to authenticated
using (public.is_admin());

drop policy if exists "Admins can update all donations" on public.donations;
create policy "Admins can update all donations"
on public.donations for update to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Organizations can already see a giver who expressed interest (support_interests
-- join, from the messaging migration); donors don't necessarily go through that
-- flow, so grant the same visibility via the donations join.
drop policy if exists "Organizations can view donors to their needs" on public.givers;
create policy "Organizations can view donors to their needs"
on public.givers for select to authenticated
using (
  exists (
    select 1 from public.donations d
    join public.organizations o on o.id = d.organization_id
    where d.giver_id = givers.id
      and o.profile_id = (select auth.uid())
  )
);

-- Storage bucket for proof-of-payment uploads (private; mirrors the
-- fulfillment-proofs / organization-documents pattern already in place).
insert into storage.buckets (id, name, public)
values ('donation-proofs', 'donation-proofs', false)
on conflict (id) do update set public = false;

drop policy if exists "Authenticated users can upload donation proofs" on storage.objects;
create policy "Authenticated users can upload donation proofs"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'donation-proofs'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Authenticated users can read donation proofs" on storage.objects;
create policy "Authenticated users can read donation proofs"
on storage.objects for select to authenticated
using (bucket_id = 'donation-proofs');
