-- Migration: 20260918000600_multi_file_uploads.sql
-- Description: Extends the two remaining single-file upload flows — donation
-- proof-of-payment and message attachments — to support multiple files per
-- donation / per message, mirroring the existing fulfillment_proofs pattern
-- (20260914002700): a child table plus a SECURITY DEFINER insert function,
-- rather than a plain RLS INSERT policy (a prior attempt at a plain INSERT
-- policy on this kind of row hit a reproducible, unexplained RLS rejection —
-- see the comment on send_notification in that same migration).
--
-- The original singular columns (donations.proof_storage_path /
-- notifications.attachment_storage_path) are left in place and still
-- populated with the FIRST file of each upload, so existing single-file
-- display code keeps working unchanged; new code additionally reads the full
-- list from these child tables.

-- --- Donation proofs (multiple proof-of-payment files per donation) --------

create table if not exists public.donation_proofs (
  id uuid primary key default gen_random_uuid(),
  donation_id uuid not null references public.donations(id) on delete cascade,
  storage_path text not null,
  file_name text,
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists donation_proofs_donation_id_idx on public.donation_proofs(donation_id);

alter table public.donation_proofs enable row level security;

drop policy if exists "Parties can view donation proofs" on public.donation_proofs;
create policy "Parties can view donation proofs"
on public.donation_proofs for select to authenticated
using (
  exists (
    select 1 from public.donations d
    join public.givers g on g.id = d.giver_id
    where d.id = donation_id and g.profile_id = (select auth.uid())
  )
  or public.is_admin()
);

create or replace function public.add_donation_proof(p_donation_id uuid, p_storage_path text, p_file_name text)
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
    select 1 from public.donations d
    join public.givers g on g.id = d.giver_id
    where d.id = p_donation_id and g.profile_id = v_uid
  ) then
    raise exception 'You are not permitted to add proof to this donation.';
  end if;

  insert into public.donation_proofs (donation_id, storage_path, file_name, uploaded_by)
  values (p_donation_id, p_storage_path, p_file_name, v_uid)
  returning id into v_new_id;

  return v_new_id;
end;
$$;
grant execute on function public.add_donation_proof(uuid, text, text) to authenticated;

-- --- Notification (message) attachments (multiple files per message) ------

create table if not exists public.notification_attachments (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications(id) on delete cascade,
  storage_path text not null,
  file_name text,
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists notification_attachments_notification_id_idx on public.notification_attachments(notification_id);

alter table public.notification_attachments enable row level security;

drop policy if exists "Parties can view notification attachments" on public.notification_attachments;
create policy "Parties can view notification attachments"
on public.notification_attachments for select to authenticated
using (
  exists (
    select 1 from public.notifications n
    where n.id = notification_id
      and (n.sender_id = (select auth.uid()) or n.recipient_id = (select auth.uid()))
  )
  or public.is_admin()
);

create or replace function public.add_notification_attachment(p_notification_id uuid, p_storage_path text, p_file_name text)
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
    select 1 from public.notifications n
    where n.id = p_notification_id and n.sender_id = v_uid
  ) then
    raise exception 'You are not permitted to add an attachment to this message.';
  end if;

  insert into public.notification_attachments (notification_id, storage_path, file_name, uploaded_by)
  values (p_notification_id, p_storage_path, p_file_name, v_uid)
  returning id into v_new_id;

  return v_new_id;
end;
$$;
grant execute on function public.add_notification_attachment(uuid, text, text) to authenticated;
