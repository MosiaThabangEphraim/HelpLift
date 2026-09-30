-- Migration: 20260927000100_donation_tamper_payer_fields.sql
-- Description: Fixes a real regression introduced by
-- 20260926000500_donation_tamper_service_role.sql - it fixed status changes
-- from service-role routes (PayFast ITN, PayPal reconcile, the cancel route)
-- but, as a side effect, also made the guest platform-donation proof-upload
-- route (app/api/public/donations/platform/[id]/route.ts, service-role,
-- since a guest has no session at all) get misclassified as "an admin
-- editing someone's payment proof" - because that route sets
-- proof_storage_path/proof_uploaded_at/payer_notes, which the admin branch
-- explicitly forbids anyone from touching. Result: a guest's own EFT proof
-- submission failed with "Admins may only update donation review fields".
--
-- Fix: decide behavior by WHAT is changing, not just WHO is connected. An
-- update that only ever touches the payer-submitted fields (proof path,
-- proof timestamp, payer notes) is unambiguously a "submit proof of
-- payment" action - safe for anyone to do, whether it's the giver's own 
-- authenticated session or a service-role route acting on behalf of a
-- guest with none, as long as the donation is still pending. Everything
-- else (status, review fields, or the donation's core identity) still goes
-- through the existing admin/service-role-vs-everyone-else split exactly as
-- before.

create or replace function public.prevent_donation_tamper()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_only_payer_fields boolean;
begin
  v_only_payer_fields :=
    new.amount = old.amount
    and new.need_id is not distinct from old.need_id
    and new.organization_id is not distinct from old.organization_id
    and new.giver_id is not distinct from old.giver_id
    and new.payment_method = old.payment_method
    and new.status = old.status
    and coalesce(new.reference_code, '') = coalesce(old.reference_code, '')
    and coalesce(new.bank_name, '') = coalesce(old.bank_name, '')
    and new.gift_offering_id is not distinct from old.gift_offering_id
    and new.is_platform_donation is not distinct from old.is_platform_donation
    and new.donor_profile_id is not distinct from old.donor_profile_id
    and new.guest_name is not distinct from old.guest_name
    and new.guest_email is not distinct from old.guest_email
    and new.reviewed_by is not distinct from old.reviewed_by
    and new.reviewed_at is not distinct from old.reviewed_at
    and coalesce(new.admin_notes, '') = coalesce(old.admin_notes, '');

  if v_only_payer_fields then
    if old.status <> 'pending' then
      raise exception 'This donation has already been reviewed';
    end if;
    return new;
  end if;

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
      or new.guest_name is distinct from old.guest_name
      or new.guest_email is distinct from old.guest_email
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
      or new.guest_name is distinct from old.guest_name
      or new.guest_email is distinct from old.guest_email
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
