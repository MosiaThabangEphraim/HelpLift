create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

create policy "Admins can view all profiles"
on public.profiles for select to authenticated
using (public.is_admin());

create policy "Admins can view all organizations"
on public.organizations for select to authenticated
using (public.is_admin());

create policy "Admins can update organizations"
on public.organizations for update to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Admins can view all givers"
on public.givers for select to authenticated
using (public.is_admin());

create policy "Admins can view all needs"
on public.needs for select to authenticated
using (public.is_admin());

create policy "Admins can update needs"
on public.needs for update to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Admins can view all support interests"
on public.support_interests for select to authenticated
using (public.is_admin());

create policy "Admins can update support interests"
on public.support_interests for update to authenticated
using (public.is_admin())
with check (public.is_admin());
