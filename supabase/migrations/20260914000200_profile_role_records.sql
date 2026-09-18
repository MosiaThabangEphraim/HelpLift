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