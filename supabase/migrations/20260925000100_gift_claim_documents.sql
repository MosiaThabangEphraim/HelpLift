-- Migration: 20260925000100_gift_claim_documents.sql
-- Description: Gift Library claims become many-to-one instead of one-to-one.
--
-- Previously, the moment one organization claimed an offering,
-- gift_offerings.status flipped to 'pending_claim' - which hid it from the
-- public "Public and orgs can view approved offerings" policy (status =
-- 'approved') immediately, so only one org could ever be in the running, and
-- a second org claiming while the first was still under review wasn't
-- possible at all.
--
-- Now: a claim is its own row (gift_claims), an offering keeps accepting
-- claims (stays 'approved', still visible to everyone) for as long as it
-- takes an admin to decide, and an org can only have one *pending* claim on
-- a given offering at a time (a partial unique index enforces this - the
-- "no duplicate claims while awaiting a decision" rule). Approving one claim
-- sets the offering to 'claimed' (removing it from the library) and
-- automatically declines every other still-pending claim on it, so nothing
-- is left dangling; an admin may still decline any individual claim earlier
-- too. gift_offerings.claimed_by_org_id keeps being set on approval - the
-- donation-organization-assignment logic for financial pledges
-- (20260923000100_donation_org_assignment_on_claim.sql) and the admin
-- withdrawal-relevant wallet totals both key off it.
--
-- Supporting documents (this migration's original purpose) now belong to one
-- specific claim attempt, not the offering as a whole - each new claim can
-- have its own files.

create table if not exists public.gift_claims (
  id uuid primary key default gen_random_uuid(),
  gift_offering_id uuid not null references public.gift_offerings(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  motivation text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  claim_notes text,
  requested_by uuid references public.profiles(id) on delete set null,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists gift_claims_offering_idx on public.gift_claims(gift_offering_id);
create index if not exists gift_claims_org_idx on public.gift_claims(organization_id);

-- The actual "can't claim again while awaiting a decision" rule: at most one
-- pending claim per (offering, organization) pair. A rejected or approved
-- claim doesn't count, so an org can claim again after being declined.
create unique index if not exists gift_claims_one_pending_per_org
on public.gift_claims(gift_offering_id, organization_id)
where status = 'pending';

alter table public.gift_claims enable row level security;

drop policy if exists "Admins can manage all gift claims" on public.gift_claims;
create policy "Admins can manage all gift claims"
on public.gift_claims for all to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Members can view their organization's claims" on public.gift_claims;
create policy "Members can view their organization's claims"
on public.gift_claims for select to authenticated
using (public.has_org_role(organization_id, 'viewer'));

drop policy if exists "Managers can submit a claim" on public.gift_claims;
create policy "Managers can submit a claim"
on public.gift_claims for insert to authenticated
with check (
  status = 'pending'
  and requested_by = (select auth.uid())
  and public.has_org_role(organization_id, 'manager')
  and exists (select 1 from public.organizations o where o.id = organization_id and o.verification_status = 'approved')
  and exists (select 1 from public.gift_offerings go where go.id = gift_offering_id and go.status = 'approved')
);

-- Finalizes a claim: approves it (and declines every other still-pending
-- claim on the same offering) or declines it on its own. Runs as the admin
-- who's reviewing, via a SECURITY DEFINER function rather than a raw UPDATE
-- so the "decline the others" side effect is one atomic, always-consistent
-- step instead of something every call site has to remember to do.
create or replace function public.review_gift_claim(p_claim_id uuid, p_approve boolean, p_notes text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_offering_id uuid;
  v_org_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Administrator access required.';
  end if;

  select gift_offering_id, organization_id into v_offering_id, v_org_id
  from public.gift_claims where id = p_claim_id and status = 'pending';
  if v_offering_id is null then
    raise exception 'This claim is no longer pending.';
  end if;

  update public.gift_claims
  set status = case when p_approve then 'approved' else 'rejected' end,
      claim_notes = p_notes,
      reviewed_by = v_uid,
      reviewed_at = now()
  where id = p_claim_id;

  if p_approve then
    update public.gift_offerings
    set status = 'claimed', claimed_by_org_id = v_org_id
    where id = v_offering_id;

    update public.gift_claims
    set status = 'rejected',
        claim_notes = 'Another organization''s claim on this offering was approved.',
        reviewed_by = v_uid,
        reviewed_at = now()
    where gift_offering_id = v_offering_id and status = 'pending' and id <> p_claim_id;
  end if;
end;
$$;
grant execute on function public.review_gift_claim(uuid, boolean, text) to authenticated;

-- Backfill: this migration was first applied in an earlier, single-claim
-- shape (gift_offerings.claimed_by_org_id / claim_motivation / claim_notes,
-- one claim per offering) before being rewritten to the current gift_claims
-- design. Anything already claimed that way gets a matching gift_claims row
-- here, so a claim made under the old shape isn't lost. Safe to run more than
-- once - it only inserts a claim that doesn't already have one.
insert into public.gift_claims (gift_offering_id, organization_id, motivation, status, claim_notes, reviewed_at)
select
  go.id,
  go.claimed_by_org_id,
  coalesce(nullif(go.claim_motivation, ''), 'Claimed before HelpLift tracked individual claims.'),
  case when go.status = 'claimed' then 'approved' else 'pending' end,
  go.claim_notes,
  case when go.status = 'claimed' then go.updated_at end
from public.gift_offerings go
where go.claimed_by_org_id is not null
  and not exists (
    select 1 from public.gift_claims gc
    where gc.gift_offering_id = go.id and gc.organization_id = go.claimed_by_org_id
  );

-- --- Supporting documents, one claim attempt at a time --------------------

-- Same earlier-shape situation as above: if gift_claim_documents already
-- exists from that first version of this migration, it has a
-- gift_offering_id column instead of claim_id. Point each document at the
-- claim just backfilled above, then drop the old column, before the
-- create-table-if-not-exists below (a no-op once this has run).
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'gift_claim_documents' and column_name = 'gift_offering_id'
  ) then
    alter table public.gift_claim_documents add column if not exists claim_id uuid references public.gift_claims(id) on delete cascade;

    update public.gift_claim_documents gcd
    set claim_id = gc.id
    from public.gift_offerings go
    join public.gift_claims gc on gc.gift_offering_id = go.id and gc.organization_id = go.claimed_by_org_id
    where gcd.claim_id is null and gcd.gift_offering_id = go.id;

    -- A document whose offering was never actually claimed (shouldn't happen) has nothing left to attach to.
    delete from public.gift_claim_documents where claim_id is null;

    -- The original version of this migration created policies with these same
    -- names, referencing gift_offering_id - they have to go before that column
    -- can be dropped. The statements further below recreate them against
    -- claim_id.
    drop policy if exists "Admins and the claiming org can view claim documents" on public.gift_claim_documents;
    drop policy if exists "Managers can attach claim documents" on public.gift_claim_documents;

    alter table public.gift_claim_documents alter column claim_id set not null;
    alter table public.gift_claim_documents drop column gift_offering_id;
  end if;
end $$;

create table if not exists public.gift_claim_documents (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.gift_claims(id) on delete cascade,
  storage_path text not null,
  file_name text,
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists gift_claim_documents_claim_idx on public.gift_claim_documents(claim_id);

alter table public.gift_claim_documents enable row level security;

drop policy if exists "Admins and the claiming org can view claim documents" on public.gift_claim_documents;
create policy "Admins and the claiming org can view claim documents"
on public.gift_claim_documents for select to authenticated
using (
  public.is_admin()
  or exists (
    select 1 from public.gift_claims gc
    where gc.id = claim_id and public.has_org_role(gc.organization_id, 'viewer')
  )
);

drop policy if exists "Managers can attach claim documents" on public.gift_claim_documents;
create policy "Managers can attach claim documents"
on public.gift_claim_documents for insert to authenticated
with check (
  uploaded_by = (select auth.uid())
  and exists (
    select 1 from public.gift_claims gc
    where gc.id = claim_id and gc.status = 'pending' and public.has_org_role(gc.organization_id, 'manager')
  )
);

-- Storage bucket for the uploaded files themselves (private; mirrors the
-- donation-proofs / withdrawal-proofs pattern - uploader's own uid folder,
-- any authenticated user may read since the app only ever hands out a signed
-- URL to an admin or the claiming organization).
insert into storage.buckets (id, name, public)
values ('gift-claim-documents', 'gift-claim-documents', false)
on conflict (id) do update set public = false;

drop policy if exists "Authenticated users can upload gift claim documents" on storage.objects;
create policy "Authenticated users can upload gift claim documents"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'gift-claim-documents'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Authenticated users can read gift claim documents" on storage.objects;
create policy "Authenticated users can read gift claim documents"
on storage.objects for select to authenticated
using (bucket_id = 'gift-claim-documents');
