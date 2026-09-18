-- Migration: 20260914002800_org_scope_completion.sql (part 1 of 2)
-- Description: Postgres refuses to use a newly-added enum value in the same
-- transaction that added it ("unsafe use of new value ... New enum values
-- must be committed before they can be used") — and the Supabase SQL Editor
-- runs an entire pasted script as one transaction. So the two new enum
-- values this feature set needs are split into their own migration, run and
-- committed on their own, before 20260914002900_org_scope_completion_part2.sql
-- (which uses them) runs as a separate statement/transaction.
--
-- Run this file FIRST. Once it succeeds, run
-- 20260914002900_org_scope_completion_part2.sql next.

alter type public.verification_status add value if not exists 'more_info_requested';
alter type public.need_status add value if not exists 'in_progress';
