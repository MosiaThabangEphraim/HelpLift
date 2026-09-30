-- "Last seen" (last signed in) for every giver, organization and admin, with
-- a personal toggle to hide it from everyone else - and WhatsApp-style
-- delivered/read status per message.

-- Nothing else on profiles is touched: the existing "Users can update their
-- own profile" / "Users can view their own profile" policies already cover
-- these two new columns for their own row (they're column-agnostic).
alter table public.profiles add column if not exists last_seen_at timestamptz;
alter table public.profiles add column if not exists show_last_seen boolean not null default true;

-- Message delivered/read status. read_at already exists (mark-as-read);
-- delivered_at is new - stamped the first time the recipient's own client
-- loads their notifications (see /api/notifications and /api/messages/thread).
alter table public.notifications add column if not exists delivered_at timestamptz;

-- profiles has no cross-user select policy (only your own row, or an admin's),
-- so another person's last_seen_at can't be read with a plain select - and it
-- shouldn't be, since a blanket policy would also expose email/phone/full_name
-- publicly. This function is the one narrow door: it returns a timestamp only
-- when that profile has left "show_last_seen" on, and nothing else about them.
create or replace function public.get_last_seen(p_profile_id uuid)
returns timestamptz
language sql
stable
security definer
set search_path = public
as $$
  select case when show_last_seen then last_seen_at else null end
  from public.profiles
  where id = p_profile_id
$$;

-- Callable by signed-in users (messages, admin lists) and by guests browsing
-- an organization's public page.
grant execute on function public.get_last_seen(uuid) to authenticated, anon;
