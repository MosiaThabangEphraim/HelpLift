-- Migration: 20260920001400_platform_feedback.sql
-- Description: Givers and organizations can rate HelpLift and say how it could
-- improve, whenever they like. Each submission is stored here and also sent to
-- every administrator as a notification (which the notification-email webhook
-- turns into an email). Rows are written by the server (se•	Offline Mode: Cache essential data for temporary offline access.rvice role) after it
-- has checked who is sending and rate-limited them; only administrators can read
-- them.

create table if not exists public.platform_feedback (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete set null,
  sender_role text not null,
  sender_name text not null,
  sender_email text,
  rating smallint not null check (rating between 1 and 5),
  message text,
  created_at timestamptz not null default now()
);

create index if not exists platform_feedback_created_at_idx on public.platform_feedback(created_at desc);
create index if not exists platform_feedback_profile_idx on public.platform_feedback(profile_id, created_at desc);

alter table public.platform_feedback enable row level security;

drop policy if exists "Admins can view platform feedback" on public.platform_feedback;
create policy "Admins can view platform feedback"
on public.platform_feedback for select to authenticated
using (public.is_admin());
