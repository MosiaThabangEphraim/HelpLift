-- Migration: 20260926000500_donation_tamper_service_role.sql
-- Description: Fixes a real bug in prevent_donation_tamper() - every
-- automatic donation confirmation (PayFast's ITN, PayPal's return route,
-- PayPal's webhook) and the giver/org "cancel this stuck payment" route all
-- update donations.status using the service-role client, which has no
-- signed-in user at all. is_admin() reads auth.uid(), which is NULL for a
-- service-role connection, so is_admin() evaluates to false there - meaning
-- every one of those updates was falling into the *non-admin* branch of this
-- trigger, which explicitly forbids changing `status`. All four have
-- therefore been silently failing (the .update() call returns an error,
-- logged and swallowed, and the donation is left stuck "pending" forever)
-- since the day this trigger's non-admin branch first blocked status
-- changes (20260914002100_gift_claims_and_financial_pledges.sql onward).
--
-- Fix: treat a service-role connection (auth.role() = 'service_role') the
-- same as an admin - it's already fully trusted, pre-vetted server code that
-- only ever touches the same review-style fields an admin can (status,
-- reviewed_at, admin_notes, payfast_payment_id), never a donation's core
-- identity (amount, need_id, organization_id, giver_id, payment_method,
-- reference_code, bank_name, gift_offering_id, is_platform_donation,
-- donor_profile_id).

create or replace function public.prevent_donation_tamper()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() or auth.role() = 'service_role' then
    if new.amount <> old.amount
      or new.need_id is distinct from old.need_id
      or new.organization_id is distinct from old.organization_id
      or new.giver_id is distinct from old.giver_id
      or new.payment_method <> old.payment_method
      or coalesce(new.reference_code, '') <> coalesce(old.reference_code, '')
      or coalesce(new.bank_name, '') <> coalesce(old.bank_name, '')
      or coalesce(new.proof_storage_path, '') <> coalesce(old.proof_storage_path, '')
      or new.gift_offering_id is distinct from old.gift_offering_id
      or new.is_platform_donation is distinct from old.is_platform_donation
      or new.donor_profile_id is distinct from old.donor_profile_id
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
      or new.giver_id is distinct from old.giver_id
      or new.payment_method <> old.payment_method
      or new.status <> old.status
      or coalesce(new.reference_code, '') <> coalesce(old.reference_code, '')
      or coalesce(new.bank_name, '') <> coalesce(old.bank_name, '')
      or new.gift_offering_id is distinct from old.gift_offering_id
      or new.is_platform_donation is distinct from old.is_platform_donation
      or new.donor_profile_id is distinct from old.donor_profile_id
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
