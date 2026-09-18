-- Migration: 20260918000400_organization_banking_details.sql
-- Description: Money currently flows giver -> HelpLift's own bank/PayFast
-- account (see lib/banking.ts BANK_ACCOUNTS and PAYFAST_MERCHANT_ID) with no
-- automated payout step to the organization afterward — an admin would need
-- to know where to actually wire funds on to the org manually. These columns
-- capture that destination so it's on file, not to automate the payout
-- itself (a real payout integration is a separate, much larger project).
alter table public.organizations add column if not exists bank_name text;
alter table public.organizations add column if not exists bank_account_holder text;
alter table public.organizations add column if not exists bank_account_number text;
alter table public.organizations add column if not exists bank_branch_code text;
alter table public.organizations add column if not exists bank_account_type text;
