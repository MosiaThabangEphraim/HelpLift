-- Migration: 20260930000300_need_reopen_request.sql
-- Description: Lets an organization ask to reopen a need it previously
-- closed, subject to fresh admin approval rather than reopening it
-- unilaterally (mirrors the original draft -> admin review -> open
-- pipeline; enforce_need_publish_rule from 20260914001500 already blocks
-- anyone but an admin from setting a need's status to 'open', so this only
-- needs a new in-between status plus somewhere to store why). Adds
-- 'reopen_pending' to the need_status enum (same pattern as 'rejected' in
-- 20260918000800 and 'in_progress' in 20260914002800) plus a reopen_reason
-- column, mirroring rejection_reason.

alter type public.need_status add value if not exists 'reopen_pending';

alter table public.needs add column if not exists reopen_reason text;
