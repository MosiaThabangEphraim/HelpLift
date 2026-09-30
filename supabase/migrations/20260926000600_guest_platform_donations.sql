-- Migration: 20260926000600_guest_platform_donations.sql
-- Description: Lets someone with no HelpLift account at all donate directly
-- to the platform from the homepage - collecting their name and email
-- (for the receipt) instead of a giver/organization identity. Every write
-- for this flow goes through the service-role client from a dedicated
-- public API route that validates everything itself first (amount limits,
-- payment method), the exact same trust pattern already used for the
-- PayFast ITN, PayPal reconciliation, and the donor-cancel route - so no
-- new RLS policy is needed here, just the columns to hold the guest's
-- details.

alter table public.donations add column if not exists guest_name text;
alter table public.donations add column if not exists guest_email text;
