-- Migration: 20260926000400_platform_donations.sql
-- Description: "Support The Platform" - a purely monetary donation that goes
-- to HelpLift itself, not to any organization or need. Reuses the existing
-- donations pipeline end to end (EFT proof-of-payment + admin approval,
-- PayFast, PayPal - all three exactly as-is), the same way a Gift Library
-- financial pledge reused it rather than building a parallel system.
--
-- Both a giver AND an organization can make this specific kind of donation
-- (it's requested in both dashboards' feedback feature), but donations.giver_id
-- is NOT NULL and only ever points at a `givers` row - an organization has no
-- such row. Rather than force an organization's donation through a giver
-- identity it doesn't have, giver_id becomes nullable and a new
-- donor_profile_id (a plain profiles reference, works for either role) is
-- used instead, but only for a platform donation - every other donation
-- shape (need, gift pledge) keeps using giver_id exactly as before.
--
-- need_id/organization_id/gift_offering_id are already nullable (see
-- 20260914002100 for gift pledges) - a platform donation just leaves all
-- three null, plus giver_id null too now. That's ambiguous with "a gift
-- pledge whose linked gift_offerings row somehow went missing" unless
-- explicit, so is_platform_donation makes the donation's purpose queryable
-- rather than inferred from what's absent.

alter table public.donations alter column giver_id drop not null;
alter table public.donations add column if not exists donor_profile_id uuid references public.profiles(id) on delete set null;
alter table public.donations add column if not exists is_platform_donation boolean not null default false;

-- --- SELECT: a donor can see their own platform donation, giver_id or not ---

drop policy if exists "Donors can view their own platform donations" on public.donations;
create policy "Donors can view their own platform donations"
on public.donations for select to authenticated
using (is_platform_donation = true and donor_profile_id = (select auth.uid()));

-- --- INSERT: extend the existing policy with the platform-donation case ---

drop policy if exists "Givers can create their own donations" on public.donations;
create policy "Givers can create their own donations"
on public.donations for insert to authenticated
with check (
  (
    giver_id is not null
    and exists (select 1 from public.givers g where g.id = giver_id and g.profile_id = (select auth.uid()))
    and (
      -- Donation toward a specific need's monetary target.
      (
        need_id is not null and organization_id is not null and gift_offering_id is null and is_platform_donation = false
        and exists (
          select 1 from public.needs n
          where n.id = need_id and n.organization_id = donations.organization_id and n.status = 'open'
        )
      )
      or
      -- General financial pledge from the Gift Library, not yet tied to a need/org.
      (
        need_id is null and organization_id is null and gift_offering_id is not null and is_platform_donation = false
        and exists (
          select 1 from public.gift_offerings go
          join public.givers g2 on g2.id = go.giver_id
          where go.id = gift_offering_id
            and g2.profile_id = (select auth.uid())
            and go.status = 'pending'
        )
      )
    )
  )
  or
  -- Direct support for the platform itself - no need, org, or gift offering,
  -- and identified by profile rather than a giver row (a giver or an
  -- organization manager/owner may both do this).
  (
    giver_id is null
    and need_id is null and organization_id is null and gift_offering_id is null and is_platform_donation = true
    and donor_profile_id = (select auth.uid())
    and exists (
      select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('giver', 'organization')
    )
  )
);

drop policy if exists "Donors can update their own pending platform donations" on public.donations;
create policy "Donors can update their own pending platform donations"
on public.donations for update to authenticated
using (is_platform_donation = true and donor_profile_id = (select auth.uid()))
with check (is_platform_donation = true and donor_profile_id = (select auth.uid()));

-- Guard the two new columns the same way every other "what is this for /
-- who is it between" column already is - immutable once set, by admin or by
-- whoever created the row.
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

-- Admin-configurable min/max for a platform donation, same pattern as
-- withdrawal_limits (see 20260924000100_platform_settings.sql).
insert into public.platform_settings (key, value) values
  ('platform_donation_limits', '{"min": 20, "max": null}'::jsonb)
on conflict (key) do nothing;
