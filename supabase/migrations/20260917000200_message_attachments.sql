-- Migration: 20260917000200_message_attachments.sql
-- Description: Lets messages sent via send_notification() (api/messages, the
-- only path that creates message_to_admin/admin_message/org_message rows)
-- carry an optional file attachment. Storage bucket + policies mirror the
-- existing donation-proofs pattern exactly (private bucket, upload gated to
-- the caller's own folder, read open to any authenticated user — the path's
-- random UUID is the actual protection, same trust model already used there).

alter table public.notifications add column if not exists attachment_storage_path text;
alter table public.notifications add column if not exists attachment_file_name text;

insert into storage.buckets (id, name, public)
values ('message-attachments', 'message-attachments', false)
on conflict (id) do update set public = false;

drop policy if exists "Authenticated users can upload message attachments" on storage.objects;
create policy "Authenticated users can upload message attachments"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'message-attachments'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Authenticated users can read message attachments" on storage.objects;
create policy "Authenticated users can read message attachments"
on storage.objects for select to authenticated
using (bucket_id = 'message-attachments');

-- send_notification() gains two optional trailing params. Function overload
-- resolution is by full signature, not name, so the old 4-arg signature has
-- to be dropped explicitly — otherwise it coexists with the new 6-arg one
-- and PostgREST can no longer tell which overload a 4-key call means.
drop function if exists public.send_notification(uuid, text, text, text);

create or replace function public.send_notification(
  p_recipient uuid,
  p_type text,
  p_title text,
  p_message text,
  p_attachment_storage_path text default null,
  p_attachment_file_name text default null
)
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

  -- Admins may message anyone; anyone may message an admin.
  if v_sender_role = 'admin' or v_recipient_role = 'admin' then
    v_allowed := true;
  end if;

  -- A giver may message any organization — organizations are public
  -- entities (listed on the needs board and their own profile page).
  if not v_allowed and v_sender_role = 'giver' and v_recipient_role = 'organization' then
    v_allowed := true;
  end if;

  -- An organization may message a giver it has an existing relationship
  -- with (expressed interest, donated, or has a fulfillment together).
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
    );
  end if;

  if not v_allowed then
    raise exception 'You are not permitted to message this recipient.';
  end if;

  insert into public.notifications (recipient_id, sender_id, type, title, message, attachment_storage_path, attachment_file_name)
  values (p_recipient, v_sender, p_type, p_title, p_message, p_attachment_storage_path, p_attachment_file_name)
  returning id into v_new_id;

  return v_new_id;
end;
$$;
grant execute on function public.send_notification(uuid, text, text, text, text, text) to authenticated;
