-- Migration: 20260914002600_admin_can_correct_donation_amount.sql
-- Description: An admin verifying proof of payment may find the amount
-- actually paid (per the bank receipt) differs from what the giver typed
-- when starting the donation — e.g. they rounded up, or paid extra. Let
-- admins correct the recorded amount at review time. The tamper guard
-- previously blocked amount changes for everyone, admins included; this
-- drops that restriction from the admin branch only (the non-admin/giver
-- branch is untouched — a giver still can never change their own amount).
create or replace function public.prevent_donation_tamper()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() then
    if new.need_id is distinct from old.need_id
      or new.organization_id is distinct from old.organization_id
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
