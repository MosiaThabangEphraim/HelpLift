-- Migration: 20260914002900_org_scope_completion_part2.sql (part 2 of 2)
-- Description: Run AFTER 20260914002800_org_scope_completion.sql has been
-- run and committed on its own (it adds the 'more_info_requested' and
-- 'in_progress' enum values this file uses — Postgres requires that to be a
-- separate, already-committed transaction).
--
-- Closes out gaps identified against the written project scope for
-- Organization Features:
--   1. Verification: a "more info requested" status, distinct from outright
--      rejection, plus a place to store the admin's request/rejection note.
--   2. Profile Management: a logo/branding asset field + public bucket.
--   3. Posting Needs: attachments (images/documents) on a need, via a
--      need_attachments table (same multi-file pattern as fulfillment_proofs
--      — insert via SECURITY DEFINER function, not a bare RLS policy).
--   4. Managing Needs: an 'in_progress' need status (distinct from a
--      fulfillment's own status) and a DELETE policy so an organization can
--      remove a need it owns (the app layer blocks deleting one that
--      already has interests, to avoid an unexpected RLS-cascade wipeout of
--      a giver's support_interests/fulfillments rows).

-- --- 1. Verification: "more info requested" -------------------------------

alter table public.organizations add column if not exists verification_notes text;

-- The organization's own "Users can update their own organization" UPDATE
-- policy has no column-level restriction (RLS can't express that directly),
-- so nothing at the database layer actually stopped an organization from
-- setting its own verification_status via a direct client call — only the
-- app-level route allowlist did. This closes that gap, while also allowing
-- the one legitimate self-service transition: resubmitting for review after
-- an admin requests more information.
create or replace function public.guard_organization_verification_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() then
    return new;
  end if;
  if new.verification_status is distinct from old.verification_status then
    if old.verification_status = 'more_info_requested' and new.verification_status = 'pending' then
      -- allowed: organization resubmitting after being asked for more info
      null;
    else
      raise exception 'Only an administrator can change verification status';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists organizations_guard_verification on public.organizations;
create trigger organizations_guard_verification
before update on public.organizations
for each row execute function public.guard_organization_verification_status();

-- --- 2. Profile Management: logo / branding --------------------------------

alter table public.organizations add column if not exists logo_url text;

insert into storage.buckets (id, name, public)
values ('organization-branding', 'organization-branding', true)
on conflict (id) do update set public = true;

drop policy if exists "Public can view organization branding" on storage.objects;
create policy "Public can view organization branding"
on storage.objects for select
using (bucket_id = 'organization-branding');

drop policy if exists "Organizations can upload their branding" on storage.objects;
create policy "Organizations can upload their branding"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'organization-branding'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Organizations can replace their branding" on storage.objects;
create policy "Organizations can replace their branding"
on storage.objects for update to authenticated
using (
  bucket_id = 'organization-branding'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

-- --- 3. Posting Needs: attachments -----------------------------------------

create table if not exists public.need_attachments (
  id uuid primary key default gen_random_uuid(),
  need_id uuid not null references public.needs(id) on delete cascade,
  storage_path text not null,
  file_name text,
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists need_attachments_need_id_idx on public.need_attachments(need_id);

alter table public.need_attachments enable row level security;

-- Needs are public content (shown on the open needs board to anyone), so
-- their attachments are too.
drop policy if exists "Anyone can view need attachments" on public.need_attachments;
create policy "Anyone can view need attachments"
on public.need_attachments for select
using (true);

create or replace function public.add_need_attachment(p_need_id uuid, p_storage_path text, p_file_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_new_id uuid;
begin
  if v_uid is null then
    raise exception 'Authentication required.';
  end if;

  if not exists (
    select 1 from public.needs n
    join public.organizations o on o.id = n.organization_id
    where n.id = p_need_id and o.profile_id = v_uid
  ) then
    raise exception 'You are not permitted to attach files to this need.';
  end if;

  insert into public.need_attachments (need_id, storage_path, file_name, uploaded_by)
  values (p_need_id, p_storage_path, p_file_name, v_uid)
  returning id into v_new_id;

  return v_new_id;
end;
$$;
grant execute on function public.add_need_attachment(uuid, text, text) to authenticated;

create or replace function public.remove_need_attachment(p_attachment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Authentication required.';
  end if;

  delete from public.need_attachments na
  using public.needs n, public.organizations o
  where na.id = p_attachment_id
    and na.need_id = n.id
    and n.organization_id = o.id
    and o.profile_id = v_uid;
end;
$$;
grant execute on function public.remove_need_attachment(uuid) to authenticated;

insert into storage.buckets (id, name, public)
values ('need-attachments', 'need-attachments', true)
on conflict (id) do update set public = true;

drop policy if exists "Public can view need attachments" on storage.objects;
create policy "Public can view need attachments"
on storage.objects for select
using (bucket_id = 'need-attachments');

drop policy if exists "Organizations can upload need attachments" on storage.objects;
create policy "Organizations can upload need attachments"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'need-attachments'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

-- --- 4. Managing Needs: delete policy ---------------------------------------

drop policy if exists "Organizations can delete their needs" on public.needs;
create policy "Organizations can delete their needs"
on public.needs for delete to authenticated
using (exists (
  select 1 from public.organizations o
  where o.id = organization_id and o.profile_id = (select auth.uid())
));

-- --- 5. Impact Stories: video support ---------------------------------------

alter table public.impact_stories add column if not exists video_url text;

-- --- 6. 'in_progress' needs stay fully live, not half-hidden ----------------
-- Everywhere a need had to be status = 'open' to be visible/actionable to the
-- public or to givers, it must now also allow 'in_progress' — otherwise a
-- need effectively disappears (and stops accepting further interest/
-- donations) the moment the first giver is accepted, which defeats needs
-- that call for multiple contributors.

drop policy if exists "Anyone can view open needs" on public.needs;
create policy "Anyone can view open needs"
on public.needs for select to authenticated
using (status in ('open', 'in_progress'));

drop policy if exists "Anyone can view open needs (anon)" on public.needs;
create policy "Anyone can view open needs (anon)"
on public.needs for select to anon
using (status in ('open', 'in_progress'));

drop policy if exists "Givers can create their interests" on public.support_interests;
create policy "Givers can create their interests"
on public.support_interests for insert to authenticated
with check ((exists (
  select 1 from public.givers g
  where g.id = giver_id and g.profile_id = (select auth.uid())
)) and exists (
  select 1 from public.needs n
  where n.id = need_id and n.status in ('open', 'in_progress')
));

drop policy if exists "Givers can create their own donations" on public.donations;
create policy "Givers can create their own donations"
on public.donations for insert to authenticated
with check (
  exists (select 1 from public.givers g where g.id = giver_id and g.profile_id = (select auth.uid()))
  and (
    (
      need_id is not null and organization_id is not null
      and exists (
        select 1 from public.needs n
        where n.id = need_id and n.organization_id = donations.organization_id and n.status in ('open', 'in_progress')
      )
    )
    or
    (
      need_id is null and organization_id is null and gift_offering_id is not null
      and exists (
        select 1 from public.gift_offerings go
        join public.givers g2 on g2.id = go.giver_id
        where go.id = gift_offering_id
          and g2.profile_id = (select auth.uid())
          and go.status = 'pending'
      )
    )
  )
);
