do $$ begin
  create type public.fulfillment_status as enum ('pending', 'in_progress', 'completed', 'cancelled');
exception when duplicate_object then null;
end $$;

create table if not exists public.fulfillments (
  id uuid primary key default gen_random_uuid(),
  interest_id uuid not null unique references public.support_interests(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  giver_id uuid not null references public.givers(id) on delete cascade,
  status public.fulfillment_status not null default 'pending',
  notes text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists fulfillments_set_updated_at on public.fulfillments;
create trigger fulfillments_set_updated_at before update on public.fulfillments
for each row execute function public.set_updated_at();

create or replace function public.prevent_fulfillment_reassignment()
returns trigger
language plpgsql
as $$
begin
  if new.interest_id <> old.interest_id or new.organization_id <> old.organization_id or new.giver_id <> old.giver_id then
    raise exception 'Fulfillment ownership cannot be changed';
  end if;
  return new;
end;
$$;

drop trigger if exists fulfillment_prevent_reassignment on public.fulfillments;
create trigger fulfillment_prevent_reassignment
before update on public.fulfillments
for each row execute function public.prevent_fulfillment_reassignment();

alter table public.fulfillments enable row level security;

drop policy if exists "Organizations can view their fulfillments" on public.fulfillments;
create policy "Organizations can view their fulfillments"
on public.fulfillments for select to authenticated
using (exists (
  select 1 from public.organizations o
  where o.id = organization_id and o.profile_id = (select auth.uid())
));

drop policy if exists "Organizations can create accepted fulfillments" on public.fulfillments;
create policy "Organizations can create accepted fulfillments"
on public.fulfillments for insert to authenticated
with check (
  exists (
    select 1 from public.organizations o
    where o.id = organization_id and o.profile_id = (select auth.uid())
  )
  and exists (
    select 1 from public.support_interests i
    join public.needs n on n.id = i.need_id
    where i.id = interest_id
      and i.giver_id = fulfillments.giver_id
      and n.organization_id = fulfillments.organization_id
      and i.status = 'accepted'
  )
);

drop policy if exists "Organizations can update their fulfillments" on public.fulfillments;
create policy "Organizations can update their fulfillments"
on public.fulfillments for update to authenticated
using (exists (
  select 1 from public.organizations o
  where o.id = organization_id and o.profile_id = (select auth.uid())
))
with check (exists (
  select 1 from public.organizations o
  where o.id = organization_id and o.profile_id = (select auth.uid())
));

drop policy if exists "Givers can view their fulfillments" on public.fulfillments;
create policy "Givers can view their fulfillments"
on public.fulfillments for select to authenticated
using (exists (
  select 1 from public.givers g
  where g.id = giver_id and g.profile_id = (select auth.uid())
));

drop policy if exists "Givers can update their fulfillments" on public.fulfillments;
create policy "Givers can update their fulfillments"
on public.fulfillments for update to authenticated
using (exists (
  select 1 from public.givers g
  where g.id = giver_id and g.profile_id = (select auth.uid())
))
with check (exists (
  select 1 from public.givers g
  where g.id = giver_id and g.profile_id = (select auth.uid())
));

drop policy if exists "Admins can view all fulfillments" on public.fulfillments;
create policy "Admins can view all fulfillments"
on public.fulfillments for select to authenticated
using (public.is_admin());

drop policy if exists "Admins can update all fulfillments" on public.fulfillments;
create policy "Admins can update all fulfillments"
on public.fulfillments for update to authenticated
using (public.is_admin())
with check (public.is_admin());
