-- Migration: 20260918000800_need_rejection.sql
-- Description: A draft need could previously only be approved & published
-- ('open') by an admin — there was no way to turn one down. Adds 'rejected'
-- to the need_status enum (same pattern already used for 'in_progress' in
-- 20260914002800) plus a rejection_reason column so the organization can see
-- why, mirroring organizations.verification_notes.
--
-- No trigger changes needed: enforce_need_publish_rule() (20260914001500)
-- only gates the transition TO 'open', and the organization-facing API route
-- already restricts organizations to setting status to 'closed'/'fulfilled'
-- only — rejecting stays an admin-only action enforced at the app layer,
-- consistent with how 'in_progress' didn't require touching that trigger.

alter type public.need_status add value if not exists 'rejected';

alter table public.needs add column if not exists rejection_reason text;
