-- Migration: 20260920001000_google_signup_completion.sql
-- Description: Signing up with Google only replaces the email-verification
-- step. A giver who signs up with Google must still complete the normal
-- registration (account type, phone, preferences and a password), so brand-new
-- Google accounts start as "registration not complete" and the site keeps
-- sending them to the completion page until they finish.
--
-- profiles.registration_complete defaults to true, so every existing account and
-- every email/password sign-up is unaffected. It is set to false only when the
-- new auth user was created by Google (raw_app_meta_data.provider = 'google').
-- The flag is flipped to true by the server (service role) after the completion
-- form is validated, not by the browser.

alter table public.profiles
  add column if not exists registration_complete boolean not null default true;

-- Same function as in 20260914000100_help_lift_auth_schema.sql, plus the flag.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, phone, role, registration_complete)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.email,
    new.raw_user_meta_data ->> 'phone',
    case
      when new.raw_user_meta_data ->> 'role' = 'organization' then 'organization'::public.app_role
      else 'giver'::public.app_role
    end,
    coalesce(new.raw_app_meta_data ->> 'provider', 'email') <> 'google'
  );
  return new;
end;
$$;
