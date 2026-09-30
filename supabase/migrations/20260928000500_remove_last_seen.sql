-- Removes the "last seen" feature entirely, per request. Message
-- delivered/read status (notifications.delivered_at, added in the same
-- earlier migration) is untouched - only the last-seen pieces go.

drop function if exists public.get_last_seen_bulk(uuid[]);
drop function if exists public.get_last_seen(uuid);

alter table public.profiles drop column if exists show_last_seen;
alter table public.profiles drop column if exists last_seen_at;
