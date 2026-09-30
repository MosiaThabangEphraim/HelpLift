-- Migration: 20260928000200_giver_spotlight_opt_out.sql
-- Description: Lets a giver opt out of ever being picked as "Giver of the
-- Month" (public homepage spotlight, see 20260928000100_monthly_spotlights.sql).
-- Organizations get no equivalent opt-out - an organization's name, needs,
-- and fulfilment activity are already public everywhere else in the app
-- (its own profile page, the needs board, impact stories), so being named
-- "Organization of the Month" isn't a new kind of exposure the way a
-- giver's identity being named publicly is.
--
-- Enforced in lib/spotlights.ts's computeGiverCandidates - an opted-out
-- giver is excluded from the candidate pool entirely, so they can never
-- become the automatic pick NOR be selectable as an admin override; this
-- is a genuine opt-out, not just a default.

alter table public.givers add column if not exists spotlight_opt_out boolean not null default false;
