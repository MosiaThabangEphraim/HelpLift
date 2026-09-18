-- Migration: 20260917000100_payfast_itn_trigger.sql
-- Description: Let the PayFast ITN webhook (api/public/payfast/notify) confirm
-- donations. That endpoint has no end-user session — it runs on the service
-- role key, so auth.uid() is null there. prevent_donation_tamper() previously
-- only allowed status/review-field changes when public.is_admin() was true,
-- which requires a logged-in admin's auth.uid(); a null auth.uid() fell into
-- the giver branch and got rejected. Service-role access already bypasses RLS
-- entirely, so treating "no auth.uid()" the same as admin here doesn't widen
-- what an end user can do — it only unblocks trusted server-side code.
--
-- This rebuilds the function from its current definition as of
-- 20260914002600_admin_can_correct_donation_amount.sql (gift_offering_id
-- null-safety + the admin amount-correction carve-out), adding only the
-- "or auth.uid() is null" clause to the admin branch.

create or replace function public.prevent_donation_tamper()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() or auth.uid() is null then
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
