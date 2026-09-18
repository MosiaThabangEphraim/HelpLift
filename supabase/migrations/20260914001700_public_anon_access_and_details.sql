-- Migration: 20260914001700_public_anon_access_and_details.sql
-- Description: (1) Fixes a bug where the "public" needs/organizations pages
-- (home page, /needs, /organizations/[id]) never actually worked for a
-- genuinely logged-out visitor — the existing SELECT policies only grant the
-- `authenticated` Postgres role, never `anon`, so anyone who wasn't already
-- signed in got zero rows back from what's supposed to be public browsing
-- (confirmed via direct anon-key REST calls). (2) Supports organizations
-- viewing full giver contact details for givers who've expressed interest in
-- their needs (name/email were already exposed via 20260914001600; this adds
-- phone/account_type visibility, which was already granted by that same
-- policy — no policy change needed there, just noting it here for context).

-- Open needs: allow anonymous browsing, matching the policy's own name
-- ("Anyone can view open needs") which was never actually true before this.
drop policy if exists "Anyone can view open needs (anon)" on public.needs;
create policy "Anyone can view open needs (anon)"
on public.needs for select to anon
using (status = 'open');

-- Approved organizations: same fix, for anonymous visitors browsing an
-- organization's public profile page or a need's linked org card.
drop policy if exists "Anonymous users can view approved organizations" on public.organizations;
create policy "Anonymous users can view approved organizations"
on public.organizations for select to anon
using (verification_status = 'approved');

-- Impact stories are already publicly viewable to any role ("Anyone can view
-- impact stories" ... USING (true), no `to` clause restricting the role), so
-- no change needed there.
