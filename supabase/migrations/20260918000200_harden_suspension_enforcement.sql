-- Migration: 20260918000200_harden_suspension_enforcement.sql
-- Description: Suspension was previously enforced only at the page/middleware
-- level (proxy.ts redirects a suspended user to /suspended, everywhere) —
-- solid for normal app usage, but a direct API call bypasses it entirely.
-- This adds a database-level backstop for actual writes.
--
-- Approach: a single BEFORE INSERT/UPDATE trigger per relevant table, not a
-- rewrite of existing RLS policies. Triggers here only ever ADD a rejection
-- on top of whatever RLS already allowed — they can't be reconstructed
-- incorrectly the way re-deriving an existing policy's exact boolean logic
-- could (see the payfast_itn_trigger migration's own note on that mistake),
-- since they don't need to know or reproduce that logic at all.
--
-- auth.uid() is null for service-role callers (webhooks, the PayFast ITN
-- handler, etc.) — is_suspended() treats that as "not suspended", so trusted
-- backend flows are unaffected, same reasoning as prevent_donation_tamper's
-- "or auth.uid() is null" carve-out.

create or replace function public.is_suspended()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((select suspended from public.profiles where id = (select auth.uid())), false);
$$;

create or replace function public.block_suspended_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_suspended() then
    raise exception 'Your account is suspended. You may only message an administrator.';
  end if;
  return new;
end;
$$;

-- Needs (organizations posting/editing community needs)
drop trigger if exists needs_block_suspended_write on public.needs;
create trigger needs_block_suspended_write
before insert or update on public.needs
for each row execute function public.block_suspended_write();

-- Support interests (givers expressing interest; organizations accepting/declining)
drop trigger if exists support_interests_block_suspended_write on public.support_interests;
create trigger support_interests_block_suspended_write
before insert or update on public.support_interests
for each row execute function public.block_suspended_write();

-- Donations (givers starting a donation / attaching proof)
drop trigger if exists donations_block_suspended_write on public.donations;
create trigger donations_block_suspended_write
before insert or update on public.donations
for each row execute function public.block_suspended_write();

-- Gift offerings (givers pledging; organizations claiming)
drop trigger if exists gift_offerings_block_suspended_write on public.gift_offerings;
create trigger gift_offerings_block_suspended_write
before insert or update on public.gift_offerings
for each row execute function public.block_suspended_write();

-- Organization supporting documents
drop trigger if exists organization_documents_block_suspended_write on public.organization_documents;
create trigger organization_documents_block_suspended_write
before insert or update on public.organization_documents
for each row execute function public.block_suspended_write();

-- Impact stories
drop trigger if exists impact_stories_block_suspended_write on public.impact_stories;
create trigger impact_stories_block_suspended_write
before insert or update on public.impact_stories
for each row execute function public.block_suspended_write();

-- Fulfillments (organizations/givers updating fulfillment progress)
drop trigger if exists fulfillments_block_suspended_write on public.fulfillments;
create trigger fulfillments_block_suspended_write
before insert or update on public.fulfillments
for each row execute function public.block_suspended_write();

-- Self profile info (name/phone/etc via api/giver/profile, api/organization/profile).
-- Safe to attach here too, alongside profiles' existing
-- prevent_profile_privilege_escalation trigger: block_suspended_write only
-- ever looks at the ACTING user's own suspension status (auth.uid()), never
-- the row being touched, so an admin editing a suspended user's row is
-- unaffected (admins aren't suspended) — this only stops a suspended user
-- from changing their own records, exactly the intent.
drop trigger if exists profiles_block_suspended_write on public.profiles;
create trigger profiles_block_suspended_write
before update on public.profiles
for each row execute function public.block_suspended_write();

drop trigger if exists organizations_block_suspended_write on public.organizations;
create trigger organizations_block_suspended_write
before insert or update on public.organizations
for each row execute function public.block_suspended_write();

drop trigger if exists givers_block_suspended_write on public.givers;
create trigger givers_block_suspended_write
before insert or update on public.givers
for each row execute function public.block_suspended_write();

-- send_notification() is the one write suspension must NOT fully block —
-- a suspended user's only remaining ability is messaging an admin. Same
-- signature as 20260917000200_message_attachments.sql, just adding the
-- suspension carve-out; no drop needed since the signature is unchanged.
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

  if public.is_suspended() and v_recipient_role <> 'admin' then
    raise exception 'Your account is suspended. You may only message an administrator.';
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
