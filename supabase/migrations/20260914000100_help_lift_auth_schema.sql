create extension if not exists pgcrypto;

do $$ begin
  create type public.app_role as enum ('giver', 'organization', 'admin');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.verification_status as enum ('pending', 'approved', 'rejected');
exception when duplicate_object then null;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  phone text,
  role public.app_role not null default 'giver',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles(id) on delete cascade,
  name text not null,
  registration_number text,
  type text not null,
  address text,
  province text,
  city text,
  contact_name text,
  contact_role text,
  contact_email text not null,
  phone text,
  mission text,
  verification_status public.verification_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.givers (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles(id) on delete cascade,
  name text not null,
  email text not null,
  phone text,
  account_type text not null default 'individual',
  preferred_categories text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, phone, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.email,
    new.raw_user_meta_data ->> 'phone',
    case
      when new.raw_user_meta_data ->> 'role' = 'organization' then 'organization'::public.app_role
      else 'giver'::public.app_role
    end
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger organizations_set_updated_at before update on public.organizations
for each row execute function public.set_updated_at();
create trigger givers_set_updated_at before update on public.givers
for each row execute function public.set_updated_at();

create or replace function public.handle_new_profile()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  metadata jsonb;
  category_text text;
begin
  select raw_user_meta_data into metadata from auth.users where id = new.id;
  category_text := nullif(trim(metadata ->> 'categories'), '');

  if new.role = 'organization' then
    insert into public.organizations (
      profile_id, name, registration_number, type, address, province, city,
      contact_name, contact_email, phone, mission
    ) values (
      new.id,
      coalesce(nullif(metadata ->> 'org_name', ''), new.full_name),
      metadata ->> 'reg_num',
      coalesce(nullif(metadata ->> 'org_type', ''), 'Other'),
      metadata ->> 'address',
      metadata ->> 'province',
      metadata ->> 'city',
      metadata ->> 'contact',
      new.email,
      new.phone,
      metadata ->> 'mission'
    ) on conflict (profile_id) do nothing;
  else
    insert into public.givers (
      profile_id, name, email, phone, account_type, preferred_categories
    ) values (
      new.id,
      new.full_name,
      new.email,
      new.phone,
      coalesce(nullif(metadata ->> 'account_type', ''), 'individual'),
      case when category_text is null then '{}'::text[] else regexp_split_to_array(category_text, '\s*,\s*') end
    ) on conflict (profile_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_profile_created on public.profiles;
create trigger on_profile_created
after insert on public.profiles
for each row execute function public.handle_new_profile();

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.givers enable row level security;

drop policy if exists "Users can view their own profile" on public.profiles;
create policy "Users can view their own profile"
on public.profiles for select to authenticated
using ((select auth.uid()) = id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
on public.profiles for update to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

drop policy if exists "Users can view their own organization" on public.organizations;
create policy "Users can view their own organization"
on public.organizations for select to authenticated
using ((select auth.uid()) = profile_id);

drop policy if exists "Users can create their own organization" on public.organizations;
create policy "Users can create their own organization"
on public.organizations for insert to authenticated
with check ((select auth.uid()) = profile_id);

drop policy if exists "Users can update their own organization" on public.organizations;
create policy "Users can update their own organization"
on public.organizations for update to authenticated
using ((select auth.uid()) = profile_id)
with check ((select auth.uid()) = profile_id);

drop policy if exists "Users can view their own giver profile" on public.givers;
create policy "Users can view their own giver profile"
on public.givers for select to authenticated
using ((select auth.uid()) = profile_id);

drop policy if exists "Users can create their own giver profile" on public.givers;
create policy "Users can create their own giver profile"
on public.givers for insert to authenticated
with check ((select auth.uid()) = profile_id);

drop policy if exists "Users can update their own giver profile" on public.givers;
create policy "Users can update their own giver profile"
on public.givers for update to authenticated
using ((select auth.uid()) = profile_id)
with check ((select auth.uid()) = profile_id);
