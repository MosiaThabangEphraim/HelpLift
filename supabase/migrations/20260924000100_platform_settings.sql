-- Migration: 20260924000100_platform_settings.sql
-- Description: Four things an admin can now control without a code change:
--   1. platform_settings   - generic key/value store (maintenance mode,
--      withdrawal min/max amounts). Readable by anyone (maintenance mode and
--      the withdrawal limits both need to be visible to signed-out/ordinary
--      users), writable only by admins.
--   2. platform_bank_accounts - HelpLift's own receiving bank accounts for
--      manual EFT donations, replacing the hardcoded BANK_ACCOUNTS constant
--      in lib/banking.ts. Seeded with the two accounts that were hardcoded,
--      using the same `key` values ('absa' / 'fnb') that existing
--      donations.bank_name rows already store, so nothing already in the
--      database becomes invalid.
--   3. donations.bank_name loses its fixed ('absa','fnb') check constraint -
--      it's validated against the live platform_bank_accounts table at the
--      API layer instead, the same pattern needs.category already uses.
--   4. need_categories - replaces the hardcoded NEED_CATEGORIES constant in
--      lib/categories.ts. needs.category stays a plain text column (not a
--      foreign key, to avoid a much larger migration); renaming a category
--      here also updates any needs already using the old name, in the same
--      request, so nothing is orphaned. "Retiring" a category just hides it
--      from new selections (is_active = false) without touching needs that
--      already use it.

-- --- 1. Generic settings -----------------------------------------------

create table if not exists public.platform_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);

alter table public.platform_settings enable row level security;

drop policy if exists "Anyone can read platform settings" on public.platform_settings;
create policy "Anyone can read platform settings"
on public.platform_settings for select
using (true);

drop policy if exists "Admins can manage platform settings" on public.platform_settings;
create policy "Admins can manage platform settings"
on public.platform_settings for all to authenticated
using (public.is_admin())
with check (public.is_admin());

insert into public.platform_settings (key, value) values
  ('maintenance_mode', '{"enabled": false, "message": "HelpLift is undergoing scheduled maintenance. Please check back shortly."}'::jsonb),
  ('withdrawal_limits', '{"min": 100, "max": null}'::jsonb)
on conflict (key) do nothing;

-- --- 2. HelpLift's own bank accounts (for manual EFT donations) --------

create table if not exists public.platform_bank_accounts (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  bank_name text not null,
  account_name text not null,
  account_number text not null,
  branch_code text not null,
  account_type text not null,
  swift_code text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists platform_bank_accounts_set_updated_at on public.platform_bank_accounts;
create trigger platform_bank_accounts_set_updated_at before update on public.platform_bank_accounts
for each row execute function public.set_updated_at();

alter table public.platform_bank_accounts enable row level security;

drop policy if exists "Anyone can read bank accounts" on public.platform_bank_accounts;
create policy "Anyone can read bank accounts"
on public.platform_bank_accounts for select
using (true);

drop policy if exists "Admins can manage bank accounts" on public.platform_bank_accounts;
create policy "Admins can manage bank accounts"
on public.platform_bank_accounts for all to authenticated
using (public.is_admin())
with check (public.is_admin());

insert into public.platform_bank_accounts (key, bank_name, account_name, account_number, branch_code, account_type, swift_code, sort_order) values
  ('absa', 'ABSA Bank', 'HelpLift', '4079635021', '632005', 'Cheque Account', 'ABSAZAJJ', 1),
  ('fnb', 'First National Bank (FNB)', 'HelpLift', '62891234567', '250655', 'Business Cheque Account', 'FIRNZAJJ', 2)
on conflict (key) do nothing;

-- donations.bank_name previously had `check (bank_name in ('absa', 'fnb'))`
-- (see 20260914001900_donations.sql) - drop it so an admin-added account
-- isn't rejected at the database level. The API validates against the live
-- platform_bank_accounts table instead.
alter table public.donations drop constraint if exists donations_bank_name_check;

-- --- 3. Need categories --------------------------------------------------

create table if not exists public.need_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists need_categories_set_updated_at on public.need_categories;
create trigger need_categories_set_updated_at before update on public.need_categories
for each row execute function public.set_updated_at();

alter table public.need_categories enable row level security;

drop policy if exists "Anyone can read need categories" on public.need_categories;
create policy "Anyone can read need categories"
on public.need_categories for select
using (true);

drop policy if exists "Admins can manage need categories" on public.need_categories;
create policy "Admins can manage need categories"
on public.need_categories for all to authenticated
using (public.is_admin())
with check (public.is_admin());

insert into public.need_categories (name, sort_order) values
  ('Education', 1),
  ('Food & Nutrition', 2),
  ('Medical & Healthcare', 3),
  ('Shelter & Housing', 4),
  ('Clothing', 5),
  ('Youth & Community', 6)
on conflict (name) do nothing;

-- Renaming a category (admin route) updates any needs already using the old
-- name in the same call; this function makes that one atomic operation.
create or replace function public.rename_need_category(p_old_name text, p_new_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Administrator access required.';
  end if;
  update public.needs set category = p_new_name where category = p_old_name;
end;
$$;
grant execute on function public.rename_need_category(text, text) to authenticated;
