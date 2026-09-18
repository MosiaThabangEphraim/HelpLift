-- Migration: 20260914002100_gift_claims_and_financial_pledges.sql
-- Description:
--   1. Repairs the gift_offerings claim flow: an organization claiming an
--      offering now moves it to a new 'pending_claim' status instead of
--      jumping straight to 'claimed' — an admin must approve (-> 'claimed')
--      or reject (-> back to 'approved', re-listed) the claim. The previous
--      "Approved organizations can claim offerings" WITH CHECK never actually
--      constrained the target status or verified claimed_by_org_id matched
--      the caller, which is the most likely source of the reported
--      "new row violates row-level security policy for table gift_offerings"
--      error; it's rewritten here regardless, idempotently.
--   2. Lets a "financial" Gift Library pledge go through the same EFT
--      bank-transfer + proof-of-payment pipeline as a need donation, instead
--      of just being a text listing. donations.need_id/organization_id
--      become nullable (a financial pledge isn't tied to a specific need or
--      org yet — an org is assigned only once it later claims the listing),
--      and a new gift_offering_id links the two rows together.
--   3. Re-issues the "Users can send messages to admins" policy exactly as
--      originally defined (20260914001600) — idempotent safety net in case
--      it was missed on the live database, given a reported failure with the
--      same "row-level security" wording.

-- --- 1. gift_offerings: new 'pending_claim' status + claim notes ---------

alter table public.gift_offerings drop constraint if exists gift_offerings_status_check;
alter table public.gift_offerings add constraint gift_offerings_status_check
  check (status in ('pending', 'approved', 'pending_claim', 'claimed', 'expired', 'rejected'));

alter table public.gift_offerings add column if not exists claim_notes text;

-- Once a claim moves off 'approved' (to pending_claim / claimed / rejected by
-- an admin), the public "status = 'approved'" SELECT policy no longer covers
-- it — but the claiming organization still needs to see and track it.
drop policy if exists "Organizations can view offerings they have claimed" on public.gift_offerings;
create policy "Organizations can view offerings they have claimed"
on public.gift_offerings for select to authenticated
using (exists (
  select 1 from public.organizations o
  where o.id = claimed_by_org_id and o.profile_id = (select auth.uid())
));

drop policy if exists "Approved organizations can claim offerings" on public.gift_offerings;
create policy "Approved organizations can claim offerings"
on public.gift_offerings for update to authenticated
using (
  status = 'approved'
  and exists (
    select 1 from public.organizations o
    where o.profile_id = (select auth.uid()) and o.verification_status = 'approved'
  )
)
with check (
  status = 'pending_claim'
  and exists (
    select 1 from public.organizations o
    where o.profile_id = (select auth.uid())
      and o.id = claimed_by_org_id
      and o.verification_status = 'approved'
  )
);

-- --- 2. donations: support gift-library financial pledges -----------------

alter table public.donations alter column need_id drop not null;
alter table public.donations alter column organization_id drop not null;
alter table public.donations add column if not exists gift_offering_id uuid references public.gift_offerings(id) on delete set null;

drop policy if exists "Givers can create their own donations" on public.donations;
create policy "Givers can create their own donations"
on public.donations for insert to authenticated
with check (
  exists (select 1 from public.givers g where g.id = giver_id and g.profile_id = (select auth.uid()))
  and (
    -- Donation toward a specific need's monetary target.
    (
      need_id is not null and organization_id is not null
      and exists (
        select 1 from public.needs n
        where n.id = need_id and n.organization_id = donations.organization_id and n.status = 'open'
      )
    )
    or
    -- General financial pledge from the Gift Library, not yet tied to a need/org.
    (
      need_id is null and organization_id is null and gift_offering_id is not null
      and exists (
        select 1 from public.gift_offerings go
        join public.givers g2 on g2.id = go.giver_id
        where go.id = gift_offering_id
          and g2.profile_id = (select auth.uid())
          and go.status = 'pending'
      )
    )
  )
);

-- Rebuild the tamper guard with null-safe comparisons now that need_id and
-- organization_id can legitimately be null (IS DISTINCT FROM instead of <>,
-- which is NULL — and therefore never true — when either side is null).
create or replace function public.prevent_donation_tamper()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() then
    if new.amount <> old.amount
      or new.need_id is distinct from old.need_id
      or new.organization_id is distinct from old.organization_id
      or new.giver_id <> old.giver_id
      or new.payment_method <> old.payment_method
      or coalesce(new.reference_code, '') <> coalesce(old.reference_code, '')
      or coalesce(new.bank_name, '') <> coalesce(old.bank_name, '')
      or coalesce(new.proof_storage_path, '') <> coalesce(old.proof_storage_path, '')
      or new.gift_offering_id is distinct from old.gift_offering_id
    then
      raise exception 'Admins may only update donation review fields';
    end if;
  else
    if old.status <> 'pending' then
      raise exception 'This donation has already been reviewed';
    end if;
    if new.amount <> old.amount
      or new.need_id is distinct from old.need_id
      or new.organization_id is distinct from old.organization_id
      or new.giver_id <> old.giver_id
      or new.payment_method <> old.payment_method
      or new.status <> old.status
      or coalesce(new.reference_code, '') <> coalesce(old.reference_code, '')
      or coalesce(new.bank_name, '') <> coalesce(old.bank_name, '')
      or new.gift_offering_id is distinct from old.gift_offering_id
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

-- --- 3. Re-issue the message-to-admin policy, exactly as originally defined ---

drop policy if exists "Users can send messages to admins" on public.notifications;
create policy "Users can send messages to admins"
on public.notifications for insert to authenticated
with check (public.is_admin_profile(recipient_id));
