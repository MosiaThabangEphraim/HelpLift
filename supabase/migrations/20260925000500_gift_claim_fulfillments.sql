-- Migration: 20260925000500_gift_claim_fulfillments.sql
-- Description: Approving a (non-financial) gift claim now creates a real
-- fulfillment record - the exact same pipeline Needs already use for
-- delivery tracking, instead of leaving the org and giver with nothing but
-- a one-line "coordinate with the donor" notification. This gets them, for
-- free, everything that pipeline already has: messaging each other, marking
-- pending -> in_progress -> completed, attaching proof photos/documents, and
-- admin visibility under the existing Fulfillments tab.
--
-- Financial pledges are skipped - there's nothing to deliver, and the money
-- side is already handled separately (linking the donation to the org, see
-- 20260923000100_donation_org_assignment_on_claim.sql).
--
-- fulfillments.interest_id was NOT NULL UNIQUE (one row per accepted
-- interest). It becomes nullable, with a new gift_offering_id filling the
-- same "what is this fulfillment for" role for a gift-sourced row. A gift
-- offering can only ever be successfully claimed once (every other pending
-- claim on it is auto-declined the moment one is approved - see
-- review_gift_claim below), so gift_offering_id is exactly as safe to make
-- UNIQUE as interest_id already was.
--
-- No new RLS policy is needed for either party to see the joined
-- gift_offerings row: organizations already have "Organizations can view
-- offerings they have claimed" / "Members can view offerings their
-- organization claimed", and givers already have "Givers can view their own
-- gift offerings" (both from earlier migrations) - a direct
-- fulfillments -> gift_offerings join (skipping gift_claims entirely, which
-- the giver has no read access to) rides on those.

alter table public.fulfillments alter column interest_id drop not null;
alter table public.fulfillments add column if not exists gift_offering_id uuid references public.gift_offerings(id) on delete cascade;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'fulfillments_gift_offering_id_key'
  ) then
    alter table public.fulfillments add constraint fulfillments_gift_offering_id_key unique (gift_offering_id);
  end if;
end $$;

alter table public.fulfillments drop constraint if exists fulfillments_one_source;
alter table public.fulfillments add constraint fulfillments_one_source
  check ((interest_id is not null) <> (gift_offering_id is not null));

-- Guard the new column the same way interest_id/organization_id/giver_id
-- already are - none of a fulfillment's "what is this for / who is it
-- between" columns may change after creation.
create or replace function public.prevent_fulfillment_reassignment()
returns trigger
language plpgsql
as $$
begin
  if new.interest_id is distinct from old.interest_id
    or new.gift_offering_id is distinct from old.gift_offering_id
    or new.organization_id <> old.organization_id
    or new.giver_id <> old.giver_id
  then
    raise exception 'Fulfillment ownership cannot be changed';
  end if;
  return new;
end;
$$;

-- review_gift_claim, extended: approving a non-financial claim now also
-- creates the fulfillment row. Runs SECURITY DEFINER (same as before), so
-- this insert isn't subject to fulfillments' own RLS insert policy (which
-- only knows about the interest-based path) - matches how this function
-- already writes to gift_claims/gift_offerings directly.
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
  v_giver_id uuid;
  v_offering_type text;
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

    select giver_id, offering_type into v_giver_id, v_offering_type
    from public.gift_offerings where id = v_offering_id;

    if v_offering_type is distinct from 'financial' then
      insert into public.fulfillments (gift_offering_id, organization_id, giver_id, status)
      values (v_offering_id, v_org_id, v_giver_id, 'pending')
      on conflict (gift_offering_id) do nothing;
    end if;
  end if;
end;
$$;
