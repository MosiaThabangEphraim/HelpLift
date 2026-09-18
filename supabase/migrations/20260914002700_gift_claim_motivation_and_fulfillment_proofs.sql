-- Migration: 20260914002700_gift_claim_motivation_and_fulfillment_proofs.sql
-- Description:
--   1. A gift_offerings.claim_motivation column so an organization can explain
--      why it wants a claimed item when requesting it, for the admin
--      approving/rejecting that claim to read.
--   2. A fulfillment_proofs table so an organization verifying a (non-
--      monetary) fulfillment can attach multiple notes/photos/documents,
--      not just the single proof_storage_path/proof_notes fulfillments
--      already had. Inserts go through a SECURITY DEFINER function rather
--      than a plain RLS policy — the messaging feature hit a reproducible,
--      unexplained RLS rejection on an otherwise-correct INSERT policy, so
--      new write paths use the same insert-via-function pattern that's
--      proven reliable instead of risking a repeat of that saga.

alter table public.gift_offerings add column if not exists claim_motivation text;

create table if not exists public.fulfillment_proofs (
  id uuid primary key default gen_random_uuid(),
  fulfillment_id uuid not null references public.fulfillments(id) on delete cascade,
  storage_path text not null,
  file_name text,
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists fulfillment_proofs_fulfillment_id_idx on public.fulfillment_proofs(fulfillment_id);

alter table public.fulfillment_proofs enable row level security;

drop policy if exists "Parties can view fulfillment proofs" on public.fulfillment_proofs;
create policy "Parties can view fulfillment proofs"
on public.fulfillment_proofs for select to authenticated
using (
  exists (
    select 1 from public.fulfillments f
    left join public.givers g on g.id = f.giver_id
    left join public.organizations o on o.id = f.organization_id
    where f.id = fulfillment_id
      and (g.profile_id = (select auth.uid()) or o.profile_id = (select auth.uid()))
  )
  or public.is_admin()
);

create or replace function public.add_fulfillment_proof(p_fulfillment_id uuid, p_storage_path text, p_file_name text)
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
    select 1 from public.fulfillments f
    join public.organizations o on o.id = f.organization_id
    where f.id = p_fulfillment_id and o.profile_id = v_uid
  ) then
    raise exception 'You are not permitted to add proof to this fulfillment.';
  end if;

  insert into public.fulfillment_proofs (fulfillment_id, storage_path, file_name, uploaded_by)
  values (p_fulfillment_id, p_storage_path, p_file_name, v_uid)
  returning id into v_new_id;

  return v_new_id;
end;
$$;
grant execute on function public.add_fulfillment_proof(uuid, text, text) to authenticated;

-- Extend send_notification's organization -> giver authorization to also
-- cover the gift-claim relationship (an org notifying the giver whose
-- listing it just claimed) — not covered by the existing
-- interest/donation/fulfillment checks, and this exact "notify giver about
-- a claim" insert was previously a raw .insert() with no policy backing it
-- at all, so it was very likely silently failing.
create or replace function public.send_notification(p_recipient uuid, p_type text, p_title text, p_message text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sender uuid := auth.uid();
  v_sender_role text;
  v_recipient_role text;
  v_new_id uuid;
  v_allowed boolean := false;
begin
  if v_sender is null then
    raise exception 'Authentication required.';
  end if;

  select role into v_sender_role from public.profiles where id = v_sender;
  select role into v_recipient_role from public.profiles where id = p_recipient;

  if v_recipient_role is null then
    raise exception 'Recipient not found.';
  end if;

  if v_sender_role = 'admin' or v_recipient_role = 'admin' then
    v_allowed := true;
  end if;

  if not v_allowed and v_sender_role = 'giver' and v_recipient_role = 'organization' then
    v_allowed := true;
  end if;

  if not v_allowed and v_sender_role = 'organization' and v_recipient_role = 'giver' then
    v_allowed := exists (
      select 1
      from public.support_interests si
      join public.needs n on n.id = si.need_id
      join public.organizations o on o.id = n.organization_id
      join public.givers g on g.id = si.giver_id
      where o.profile_id = v_sender and g.profile_id = p_recipient
    ) or exists (
      select 1
      from public.donations d
      join public.organizations o on o.id = d.organization_id
      join public.givers g on g.id = d.giver_id
      where o.profile_id = v_sender and g.profile_id = p_recipient
    ) or exists (
      select 1
      from public.fulfillments f
      join public.organizations o on o.id = f.organization_id
      join public.givers g on g.id = f.giver_id
      where o.profile_id = v_sender and g.profile_id = p_recipient
    ) or exists (
      select 1
      from public.gift_offerings go
      join public.organizations o on o.id = go.claimed_by_org_id
      join public.givers g on g.id = go.giver_id
      where o.profile_id = v_sender and g.profile_id = p_recipient
    );
  end if;

  if not v_allowed then
    raise exception 'You are not permitted to message this recipient.';
  end if;

  insert into public.notifications (recipient_id, sender_id, type, title, message)
  values (p_recipient, v_sender, p_type, p_title, p_message)
  returning id into v_new_id;

  return v_new_id;
end;
$$;
