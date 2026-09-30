-- Migration: 20260923000100_donation_org_assignment_on_claim.sql
-- Description: A "financial" Gift Library pledge's donation is created with
-- need_id/organization_id both null (see 20260914002100) - no organization is
-- involved until one later claims the listing and an admin approves that
-- claim. But nothing ever set donations.organization_id at that point, so the
-- donation never appeared in the claiming organization's donations list or
-- analytics ("Funds received" never counted it), even after the claim was
-- fully approved and the payment confirmed.
--
-- This rebuilds prevent_donation_tamper() (from its current definition as of
-- 20260917000100_payfast_itn_trigger.sql) to allow exactly one additional
-- case: an admin filling in organization_id for the first time (it was null)
-- on a donation already linked to a gift_offering, without touching need_id.
-- Reassigning an already-set organization_id, or touching need-linked
-- donations (whose organization_id is never null), is still blocked.

create or replace function public.prevent_donation_tamper()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_assignment_ok boolean;
begin
  -- A financial pledge's donation being linked to the organization that just
  -- had its claim approved: organization_id moves from null to a value, the
  -- donation is (and stays) tied to a gift offering, and need_id is untouched.
  v_org_assignment_ok := (
    old.organization_id is null
    and old.gift_offering_id is not null
    and new.gift_offering_id is not distinct from old.gift_offering_id
    and new.need_id is not distinct from old.need_id
  );

  if public.is_admin() or auth.uid() is null then
    if new.need_id is distinct from old.need_id
      or (new.organization_id is distinct from old.organization_id and not v_org_assignment_ok)
      or new.giver_id <> old.giver_id
      or new.payment_method <> old.payment_method
      or coalesce(new.reference_code, '') <> coalesce(old.reference_code, '')
      or coalesce(new.bank_name, '') <> coalesce(old.bank_name, '')
      or coalesce(new.proof_storage_path, '') <> coalesce(old.proof_storage_path, '')
      or new.gift_offering_id is distinct from old.gift_offering_id
    then
      raise exception 'Admins may only update donation review fields (status, amount, admin_notes)';
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

-- Back-fill: any financial pledge already claimed (gift_offerings.status =
-- 'claimed') whose donation is still missing its organization_id.
update public.donations d
set organization_id = go.claimed_by_org_id
from public.gift_offerings go
where d.gift_offering_id = go.id
  and go.status = 'claimed'
  and go.claimed_by_org_id is not null
  and d.organization_id is null;
