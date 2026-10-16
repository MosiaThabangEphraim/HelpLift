-- Migration: 20261013000200_need_funding_progress.sql
-- Description: Shows how much of a need is still needed, and stops donations
-- once a money target is met.
--
--   needs.amount_raised          - total of the need's successful (confirmed)
--                                  donations. Kept up to date by a trigger on
--                                  donations; nobody can set it by hand.
--   needs.quantity_still_needed  - free text the organization updates as goods
--                                  arrive (e.g. "40 learners"), shown next to
--                                  the original quantity. Null = not tracked.
--
-- New donations to a need with a money target are refused once the target
-- is reached, and a single donation can't be more than what's still needed.
-- Only confirmed donations count, so an abandoned pending EFT never blocks
-- anyone. Administrators are not limited (e.g. when recording a donation).

alter table public.needs add column if not exists amount_raised numeric(12, 2) not null default 0;
alter table public.needs add column if not exists quantity_still_needed text;

-- --- Keep amount_raised in step with confirmed donations ------------------

create or replace function public.recompute_need_amount_raised(p_need_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_need_id is null then return; end if;
  -- Lets the guard below accept this one write.
  perform set_config('helplift.recompute_raised', 'on', true);
  update public.needs n
  set amount_raised = coalesce((
    select sum(d.amount) from public.donations d
    where d.need_id = p_need_id and d.status = 'successful' and d.is_platform_donation = false
  ), 0)
  where n.id = p_need_id;
  perform set_config('helplift.recompute_raised', 'off', true);
end;
$$;

create or replace function public.donations_sync_need_raised()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    perform public.recompute_need_amount_raised(old.need_id);
  end if;
  if tg_op in ('INSERT', 'UPDATE') and (tg_op = 'INSERT' or new.need_id is distinct from old.need_id or new.status is distinct from old.status or new.amount is distinct from old.amount) then
    perform public.recompute_need_amount_raised(new.need_id);
  end if;
  return null;
end;
$$;

drop trigger if exists donations_sync_need_raised on public.donations;
create trigger donations_sync_need_raised
after insert or update or delete on public.donations
for each row execute function public.donations_sync_need_raised();

-- Organizations can update their own needs, but not the raised total.
create or replace function public.protect_need_amount_raised()
returns trigger
language plpgsql
as $$
begin
  if new.amount_raised is distinct from old.amount_raised
     and coalesce(current_setting('helplift.recompute_raised', true), 'off') <> 'on' then
    new.amount_raised := old.amount_raised;
  end if;
  return new;
end;
$$;

drop trigger if exists needs_protect_amount_raised on public.needs;
create trigger needs_protect_amount_raised
before update on public.needs
for each row execute function public.protect_need_amount_raised();

-- --- Refuse donations a need no longer needs -------------------------------

create or replace function public.enforce_need_donation_cap()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target numeric;
  v_raised numeric;
begin
  if new.need_id is null or new.is_platform_donation or public.is_admin() then
    return new;
  end if;
  select target_amount, amount_raised into v_target, v_raised from public.needs where id = new.need_id;
  if v_target is null then
    return new;
  end if;
  if v_raised >= v_target then
    raise exception 'This need is fully funded and no longer accepts donations.';
  end if;
  if new.amount > v_target - v_raised then
    raise exception 'Only R% is still needed for this need.', to_char(v_target - v_raised, 'FM999999990.00');
  end if;
  return new;
end;
$$;

drop trigger if exists donations_enforce_need_cap on public.donations;
create trigger donations_enforce_need_cap
before insert on public.donations
for each row execute function public.enforce_need_donation_cap();

-- --- Backfill existing needs ------------------------------------------------

do $$
declare r record;
begin
  for r in select distinct need_id from public.donations where need_id is not null loop
    perform public.recompute_need_amount_raised(r.need_id);
  end loop;
end;
$$;
