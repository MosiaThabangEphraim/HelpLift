-- Migration: 20260927000200_badges.sql
-- Description: Motivational badges for givers and organizations. Badges are
-- NEVER stored as the source of truth for what's displayed - they're
-- recomputed fresh from existing data (donations, needs, fulfillments,
-- impact_stories, ...) every time a dashboard asks for them (see
-- lib/badges.ts). This table exists purely as a notification ledger: the
-- first time a badge is computed as earned for a giver/organization, a row
-- is written here so the "you earned a badge!" in-app notification (and,
-- via the existing notification-created webhook, its email) is only ever
-- sent once, not on every dashboard load. It also gives the UI a stable
-- "earned on" date, since the badge computation itself has no memory of
-- when a threshold was first crossed.
--
-- Only ever written by server code (the giver/organization badges API
-- routes), using the service-role client - same trust pattern as
-- donation_proofs and the guest donation routes. No RLS policy is added for
-- authenticated/anon roles; there's nothing for a client to safely do here
-- directly (the badge catalog and thresholds live in server code and
-- platform_settings, not in anything a client posts).

create table if not exists public.badge_awards (
  id uuid primary key default gen_random_uuid(),
  subject_type text not null check (subject_type in ('giver', 'organization')),
  subject_id uuid not null,
  badge_key text not null,
  earned_at timestamptz not null default now()
);
create unique index if not exists badge_awards_unique on public.badge_awards(subject_type, subject_id, badge_key);
create index if not exists badge_awards_subject_idx on public.badge_awards(subject_type, subject_id);

alter table public.badge_awards enable row level security;

-- Admin-configurable minimums for the badges that need one (money/count/rate/
-- time thresholds). Anniversary-style badges (giver account age, organization
-- verified-since age) are deliberately not configurable here - a year is a
-- year. See lib/badges.ts for how each of these is actually used.
insert into public.platform_settings (key, value) values
  ('badge_thresholds', '{
    "giver": {
      "milestoneAmounts": { "bronze": 500, "silver": 2500, "gold": 10000 },
      "streakMonths": 3,
      "needsFulfilledMin": 3,
      "categoryChampionMin": 5,
      "wellRoundedCategoriesMin": 4,
      "giftLibraryContributorMin": 3,
      "platformSupporterMin": 1,
      "reachOrgsMin": 3
    },
    "organization": {
      "needsFulfilledAmounts": { "bronze": 5, "silver": 20, "gold": 50 },
      "fundsRaisedAmounts": { "bronze": 5000, "silver": 25000, "gold": 100000 },
      "storytellerMin": 3,
      "reliabilityMinRate": 80,
      "reliabilityMinSample": 5,
      "responsivenessMaxHours": 48,
      "responsivenessMinSample": 3
    }
  }'::jsonb)
on conflict (key) do nothing;
