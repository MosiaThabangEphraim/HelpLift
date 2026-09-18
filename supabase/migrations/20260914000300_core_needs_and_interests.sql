do $$ begin
  create type public.need_status as enum ('draft', 'open', 'fulfilled', 'closed');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type public.interest_status as enum ('pending', 'accepted', 'declined');
exception when duplicate_object then null;
end $$;

create table if not exists public.needs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  description text not null,
  category text not null,
  location text,
  quantity text,
  target_amount numeric(12,2),
  due_date date,
  status public.need_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.support_interests (
  id uuid primary key default gen_random_uuid(),
  need_id uuid not null references public.needs(id) on delete cascade,
  giver_id uuid not null references public.givers(id) on delete cascade,
  message text,
  status public.interest_status not null default 'pending',
  created_at timestamptz not null default now(),
  unique (need_id, giver_id)
);

create or replace function public.prevent_giver_change()
returns trigger
language plpgsql
as $$
begin
  if new.giver_id <> old.giver_id then
    raise exception 'giver_id cannot be changed';
  end if;
  return new;
end;
$$;

drop trigger if exists support_interests_prevent_giver_change on public.support_interests;
create trigger support_interests_prevent_giver_change
before update on public.support_interests
for each row execute function public.prevent_giver_change();

drop trigger if exists needs_set_updated_at on public.needs;
create trigger needs_set_updated_at before update on public.needs
for each row execute function public.set_updated_at();

alter table public.needs enable row level security;
alter table public.support_interests enable row level security;

drop policy if exists "Authenticated users can view approved organizations" on public.organizations;
create policy "Authenticated users can view approved organizations"
on public.organizations for select to authenticated
using (
  verification_status = 'approved'
  or profile_id = (select auth.uid())
);

drop policy if exists "Anyone can view open needs" on public.needs;
create policy "Anyone can view open needs"
on public.needs for select to authenticated
using (status = 'open');

drop policy if exists "Organizations can view their needs" on public.needs;
create policy "Organizations can view their needs"
on public.needs for select to authenticated
using (exists (
  select 1 from public.organizations o
  where o.id = organization_id and o.profile_id = (select auth.uid())
));

drop policy if exists "Organizations can create their needs" on public.needs;
create policy "Organizations can create their needs"
on public.needs for insert to authenticated
with check ((exists (
  select 1 from public.organizations o
  where o.id = organization_id and o.profile_id = (select auth.uid())
)) and status = 'draft');

drop policy if exists "Organizations can update their needs" on public.needs;
create policy "Organizations can update their needs"
on public.needs for update to authenticated
using (exists (
  select 1 from public.organizations o
  where o.id = organization_id and o.profile_id = (select auth.uid())
))
with check (exists (
  select 1 from public.organizations o
  where o.id = organization_id and o.profile_id = (select auth.uid())
));

drop policy if exists "Givers can view their interests" on public.support_interests;
create policy "Givers can view their interests"
on public.support_interests for select to authenticated
using (exists (
  select 1 from public.givers g
  where g.id = giver_id and g.profile_id = (select auth.uid())
));

drop policy if exists "Givers can create their interests" on public.support_interests;
create policy "Givers can create their interests"
on public.support_interests for insert to authenticated
with check ((exists (
  select 1 from public.givers g
  where g.id = giver_id and g.profile_id = (select auth.uid())
)) and exists (
  select 1 from public.needs n
  where n.id = need_id and n.status = 'open'
));

drop policy if exists "Organizations can view interests for their needs" on public.support_interests;
create policy "Organizations can view interests for their needs"
on public.support_interests for select to authenticated
using (exists (
  select 1 from public.needs n
  join public.organizations o on o.id = n.organization_id
  where n.id = need_id and o.profile_id = (select auth.uid())
));

drop policy if exists "Organizations can update interests for their needs" on public.support_interests;
create policy "Organizations can update interests for their needs"
on public.support_interests for update to authenticated
using (exists (
  select 1 from public.needs n
  join public.organizations o on o.id = n.organization_id
  where n.id = need_id and o.profile_id = (select auth.uid())
));
