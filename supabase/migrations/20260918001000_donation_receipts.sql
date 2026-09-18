-- Migration: 20260918001000_donation_receipts.sql
-- Description: Tracks whether a PDF donation receipt has been emailed to the
-- giver, so the admin UI can show "Send receipt" vs "Resend receipt" and a
-- last-sent timestamp. The receipt itself is generated on demand (not
-- stored) by app/api/admin/donations/[id]/receipt — this column is just the
-- record of the last send.

alter table public.donations add column if not exists receipt_sent_at timestamptz;
