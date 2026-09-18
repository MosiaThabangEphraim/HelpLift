create policy "Admins can create fulfillments"
on public.fulfillments for insert to authenticated
with check (public.is_admin());
