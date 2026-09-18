-- Gives givers a location preference, mirroring preferred_categories, so
-- registration/profile can capture it per the spec ("set preferences for
-- need types and locations") and the matching system can use it later.
alter table public.givers
  add column if not exists preferred_locations text[] not null default '{}';

create or replace function public.handle_new_profile()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  metadata jsonb;
  category_text text;
  location_text text;
begin
  select raw_user_meta_data into metadata from auth.users where id = new.id;
  category_text := nullif(trim(metadata ->> 'categories'), '');
  location_text := nullif(trim(metadata ->> 'locations'), '');

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
      profile_id, name, email, phone, account_type, preferred_categories, preferred_locations
    ) values (
      new.id,
      new.full_name,
      new.email,
      new.phone,
      coalesce(nullif(metadata ->> 'account_type', ''), 'individual'),
      case when category_text is null then '{}'::text[] else regexp_split_to_array(category_text, '\s*,\s*') end,
      case when location_text is null then '{}'::text[] else regexp_split_to_array(location_text, '\s*,\s*') end
    ) on conflict (profile_id) do nothing;
  end if;

  return new;
end;
$$;
