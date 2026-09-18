-- Migration: 20260914001400_admin_edit_policies.sql
-- Description: Grant administrators full UPDATE/INSERT/DELETE on public.profiles
-- so the admin panel can promote/demote roles, edit user names, and manage profiles.

drop policy if exists "Admins can update all profiles" on public.profiles;
create policy "Admins can update all profiles"
on public.profiles for update to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins can insert profiles" on public.profiles;
create policy "Admins can insert profiles"
on public.profiles for insert to authenticated
with check (public.is_admin());

drop policy if exists "Admins can delete profiles" on public.profiles;
create policy "Admins can delete profiles"
on public.profiles for delete to authenticated
using (public.is_admin());
