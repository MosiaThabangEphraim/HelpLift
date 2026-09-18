-- Migration: 20260918000900_contact_inquiry_notifications.sql
-- Description: The homepage "Partner with us" contact form only ever sent an
-- email (api/contact/route.ts) — it never showed up anywhere inside the
-- platform, so an admin who missed the email had no other way to find it.
-- Adds a notification so contact-form inquiries also appear in the admin's
-- Messages tab, same as any other message-to-admin.
--
-- This can't reuse send_notification() (20260914001600 / 20260914002700),
-- which requires auth.uid() and raises if it's null — the contact form is
-- public and unauthenticated, so there is no signed-in sender. This function
-- is intentionally callable by the anon role and picks a recipient via the
-- existing get_any_admin_id() helper, mirroring how message_to_admin already
-- works for signed-in users.

create or replace function public.add_contact_inquiry(p_email text, p_message text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid;
  v_new_id uuid;
begin
  if p_email is null or btrim(p_email) = '' then
    raise exception 'An email address is required.';
  end if;
  if p_message is null or btrim(p_message) = '' then
    raise exception 'A message is required.';
  end if;

  v_admin_id := public.get_any_admin_id();
  if v_admin_id is null then
    raise exception 'No administrator account is available to receive this inquiry.';
  end if;

  insert into public.notifications (recipient_id, sender_id, sender_name, sender_role, type, title, message)
  values (v_admin_id, null, p_email, 'visitor', 'contact_inquiry', 'Partnership inquiry', p_message)
  returning id into v_new_id;

  return v_new_id;
end;
$$;
grant execute on function public.add_contact_inquiry(text, text) to anon, authenticated;
