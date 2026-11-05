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