-- Migration: 20261013000300_need_support_type.sql
-- Description: Each need states what kind of support it wants:
--   'goods' - items or help (givers express interest; no money donations)
--   'money' - funds only (givers donate; no offers of goods)
--   'both'  - either
-- A money or both need must have a money target; a goods-only need has none.
-- Existing needs are backfilled from what they already have: a target and a
-- quantity = both, only a target = money, otherwise goods.

alter table public.needs add column if not exists support_type text;

update public.needs
set support_type = case
  when target_amount is not null and coalesce(trim(quantity), '') <> '' then 'both'
  when target_amount is not null then 'money'
  else 'goods'
end
where support_type is null;

alter table public.needs alter column support_type set default 'goods';
alter table public.needs alter column support_type set not null;

alter table public.needs drop constraint if exists needs_support_type_check;
alter table public.needs add constraint needs_support_type_check
  check (support_type in ('goods', 'money', 'both'));

-- Money needs need a target; goods-only needs can't take money.
alter table public.needs drop constraint if exists needs_support_type_target_check;
alter table public.needs add constraint needs_support_type_target_check
  check (
    (support_type = 'goods' and target_amount is null)
    or (support_type in ('money', 'both') and target_amount is not null and target_amount > 0)
  ) not valid;
-- "not valid": older rows that don't fit (e.g. a both-need saved without a
-- target) aren't rejected retroactively; every new insert and update is checked.

-- Offers of goods/help only for needs that want goods.
create or replace function public.enforce_interest_support_type()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from public.needs n where n.id = new.need_id and n.support_type = 'money') then
    raise exception 'This need is asking for money only - please donate instead.';
  end if;
  return new;
end;
$$;

drop trigger if exists support_interests_enforce_support_type on public.support_interests;
create trigger support_interests_enforce_support_type
before insert on public.support_interests
for each row execute function public.enforce_interest_support_type();
