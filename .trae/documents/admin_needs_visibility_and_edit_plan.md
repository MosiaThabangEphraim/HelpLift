# Admin Dashboard Fixes — Needs Visibility & Full Org/User Edit

## Repository Research

### Issue 1: Needs Not Appearing In Admin Dashboard — ROOT CAUSE
At [admin-dashboard/page.tsx line 66](file:///c:/Users/mosia/HelpLift/Frontend/app/admin-dashboard/page.tsx#L66) the admin `loadData()` runs:
```js
supabase.from("needs").select("id, title, description, category, urgency, status, organizations(name)")
```
The query hard-selects the `urgency` column with **NO error fallback retry** — exactly the same bug we just fixed on the org dashboard. If the `urgency` column has any mismatch (e.g. migration 0012 was never applied on this Supabase project), the entire Promise resolves with `error !== null`, and `allNeeds = null` (since there's no destructuring guard). On line 73 `setNeeds((allNeeds || []) as Need[])` then assigns `[]` — hence the admin sees zero needs, no error, no clue.

Also, on line 63 the queries are destructured inside `Promise.all` with `{ data: orgs }` but there is **no error destructuring and no Promise.all error handling** — so if ANY query inside the parallel `Promise.all` throws, the entire loadData silently fails (caught only by surrounding try/catch but that error is not routed to the `setError` banner either). That's a secondary amplifier.

### Issue 2: Admin Cannot Edit/Update Organizations or Users — GAPS

#### Organizations API gap:
Current [admin/organizations/[id]/route.ts](file:///c:/Users/mosia/HelpLift/Frontend/app/api/admin/organizations/%5Bid%5D/route.ts#L19-L22) ONLY reads `verification_status` from `request.json()` and ignores all other fields. If admin wants to fix a typo in the org's `name`, change `contact_email`, or update `type`, `city`, `province`, `address`, or `phone` — there is no way. This violates spec §4.3 "Platform Management" (managing organizations).

#### Users / Profiles API gap:
Current [admin/users/route.ts](file:///c:/Users/mosia/HelpLift/Frontend/app/api/admin/users/route.ts) has ONLY `POST` (create new admin). There is **NO `PATCH` / `PUT` endpoint** at `api/admin/users/[id]` for updating existing profiles. Admin cannot:
- Change a user's `full_name`
- Change user's `role` (promote to admin, demote, switch between giver↔organization)
- Reset password
- Change email (auth-level) or disable account
- Edit anything else

#### UI gaps:
- [admin-dashboard/page.tsx OrganizationsView](file:///c:/Users/mosia/HelpLift/Frontend/app/admin-dashboard/page.tsx#L217-L255): Only has Approve / Reject buttons. No "Edit" button for org fields.
- [admin-dashboard/page.tsx UsersView](file:///c:/Users/mosia/HelpLift/Frontend/app/admin-dashboard/page.tsx#L340-L354): 100% read-only — shows name, email, role. Zero action buttons. No way to promote user to admin, change role, edit name, etc.
- The dashboard has NO dialog/modal components currently imported for editing records. So we must add inline-Edit modals using existing Dialog primitives (shadcn dialog already exists in `components/ui/dialog.tsx`).

---

## Files and Modules

| File | Expected Change |
|---|---|
| `Frontend/app/admin-dashboard/page.tsx` | (1) Fix needs query with urgency fallback + wrap Promise.all with defensive try/catch per-promise so one bad query doesn't kill the whole dashboard. (2) Add Edit button + inline dialog forms for editing both organizations (name, type, contact_email, city, province, address, phone) and users/profiles (full_name, email, role, password reset). Import Dialog/Button/Input etc. |
| `Frontend/app/api/admin/organizations/[id]/route.ts` | Extend PATCH: allow admin to update MORE than just verification_status — accept an allowlist of org fields (name, type, contact_email, phone, address, city, province, verification_status). Merge update payload with verification_status, so old Approve/Reject button calls keep working. |
| `Frontend/app/api/admin/users/route.ts` | No change. Stays as POST for create admin. |
| **NEW** `Frontend/app/api/admin/users/[id]/route.ts` | Add PATCH endpoint for updating a user profile by id. Accept allowlisted fields: full_name, role, password (optional password reset). Role must be one of admin/organization/giver. If password supplied ≥8 chars, use supabase `auth.admin.updateUserById`. |
| **NEW** `supabase/migrations/20260914001400_admin_edit_policies.sql` | Ensure `profiles` RLS permits admin UPDATE for all allowlisted fields. Currently the 0004 migration only has "Admins can view all profiles" SELECT policy — missing UPDATE policy. Without it, the PATCH API will be blocked by RLS. |

---

## Implementation Steps (Dependency Order)

### Step 0 — Pre-requisite: Add RLS policies for admin profile updates
- Create migration `20260914001400_admin_edit_policies.sql`:
  - `drop policy if exists` then create `CREATE POLICY "Admins can update all profiles"` on `public.profiles` FOR UPDATE TO authenticated `USING (public.is_admin()) WITH CHECK (public.is_admin())`.
  - Also verify/update `organizations` admin UPDATE — currently exists from 0004, confirm it still covers arbitrary field updates (yes, `using(is_admin)` + `with check(is_admin)` covers all columns).

### Step 1 — Build admin users PATCH endpoint (idempotent API)
- Create `Frontend/app/api/admin/users/[id]/route.ts`:
  - Guard: admin auth check (matching existing patterns).
  - Read body: allowlisted fields only — `{ full_name?, role?, password? }`
  - Validate: if `role` present must be ∈ { admin, organization, giver }
  - Validate: if `password` present must be ≥8 chars
  - If password present: call `supabase.auth.admin.updateUserById(id, { password })` — requires the SERVICE_ROLE key usage (check existing server client). Note: may need to create a service-role client via `createServerClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken:false, persistSession:false } })`.
  - Update `profiles` row with allowlisted fields.
  - Return updated profile.

### Step 2 — Upgrade admin organizations PATCH for arbitrary field edits
- Edit `Frontend/app/api/admin/organizations/[id]/route.ts`:
  - Accept additional fields from body: `name, type, contact_email, phone, address, city, province, verification_status`
  - Build updateObject by spread only allowing these keys in
  - Keep existing notifications logic when `verification_status` is provided
  - Continue to accept the old payload shape `{ verification_status }` for backwards compat with existing Approve/Reject buttons
  - Return updated organization with full fields needed for dashboard re-render

### Step 3 — Admin dashboard: Fix Needs query loading (urgency fallback + per-promise try/catch)
- Edit `loadData()` in admin-dashboard `page.tsx`:
  - Replace the naked `Promise.all([...])` destructuring. Instead run each Promise in individual try/catch so one failing query doesn't take down the whole dashboard
  - For the needs query specifically: add the urgency fallback pattern (match what we built for org dashboard): query WITH urgency → if error contains 'urgency' retry WITHOUT urgency → default urgency to 'medium' per row
  - For needs error, `setError("Could not load needs: " + msg)` for visibility
  - Same per-promise error handling for orgs, users, interests — surface a visible error via setError instead of silent null

### Step 4 — Admin dashboard: Add Edit Organization dialog
- In `admin-dashboard/page.tsx`:
  - Add the required `Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger` imports from `@/components/ui/dialog`
  - Add `Button, Input, Label, Select` etc. as needed (already imported via other shadcn UI uses, confirm)
  - Add state: `editingOrganization: Organization | null`
  - Build a controlled form inside a Dialog with inputs for: name, type, contact_email, phone, address, city, province, and a Select for verification_status (pending/approved/rejected)
  - When Edit clicked → open dialog → prefill current values → save calls PATCH `/api/admin/organizations/${id}` → await → close → `loadData()` to refresh
  - Keep existing Approve / Reject buttons — they still work and don't need the dialog

### Step 5 — Admin dashboard: Add Edit User / Profile dialog
- In same file:
  - Add state: `editingProfile: Profile | null`
  - Add Dialog with inputs for: `full_name`, `email` (read-only display, or optional), `role` (select with admin/organization/giver), `password` (optional reset field)
  - Save button calls new PATCH `/api/admin/users/${id}` with fields
  - After successful save → close dialog → `loadData()`
  - Insert an **Edit** button in the UsersView row for every profile (alongside the existing role badge)

### Step 6 — Verify + Run diagnostics
- `GetDiagnostics` for all edited/created TS files
- Manual walkthrough scenarios below

---

## Dependencies and Considerations
- **Service role key for password resets**: Standard supabase anon client cannot use `auth.admin.updateUserById`. For password reset PATCH, we MUST instantiate a separate service-role client using `SUPABASE_SERVICE_ROLE_KEY`. Check `.env.example` if present — confirm env var exists.
- **Backwards compatibility**: Existing Approve/Reject buttons POST `{ verification_status }` to the org PATCH. New endpoint must still accept that. We use spread + allowlist filter so both merge safely.
- **Email changes to Auth layer**: Changing a user's `email` in `profiles` table desyncs from `auth.users`. For safety first pass shows email as READ-ONLY in the edit dialog. Only full_name, role, and password reset are editable. Admin can always create new users.
- **Role switching side effects**: When admin changes a profile's role, the user may be e.g. role "giver" suddenly with no `givers` row, or "organization" with no org row. The dashboard will surface this as new user type without the associated entity. That matches §4.3 "manage user roles".
- **Use existing UI primitives only**: Dialog, Button, Input, Label, Select components all exist in the `components/ui/` directory — no new libraries.

---

## Validation
After implementation, verify the following scenarios work:

### Scenario A: Admin can now see all needs
1. Log in as admin → Needs tab. Confirm count > 0 (assuming seed/created needs exist).
2. Count should match the database `select count(*) from public.needs`.
3. Draft needs show "Awaiting approval" highlight and "Approve & Publish" button.
4. If urgency column is missing, fallback still loads needs and defaults urgency=medium silently.

### Scenario B: Admin edits organization fields
1. Admin → Organizations tab → Click new **Edit** button on any org.
2. Change org name and contact_email → Save.
3. Dialog closes → Org row immediately re-renders with new values (loadData refreshed).
4. PATCH endpoint should return 200 with updated org.
5. Existing Approve/Reject buttons (no dialog) continue to work.

### Scenario C: Admin edits user fields + promotes/demotes roles
1. Admin → Users tab → Click new **Edit** button.
2. Change full_name, set role = "admin" → Save.
3. Verify profile row updates to reflect new name + new role badge.
4. Password reset: type new 8+ char password in the optional password field → Save → user can log in with new password.

### Scenario D: Security checks
1. Non-admin tries to PATCH `/api/admin/users/:id` → HTTP 403.
2. Non-admin tries to PATCH org endpoint with non-status fields → HTTP 403.
3. User update payload with extra fields (e.g. "id", "created_at") → field whitelist strips them.

### Scenario E: Diagnostics
- `GetDiagnostics` on edited TS files → zero type/lint errors.

---

## Risks

| Risk | Mitigation |
|---|---|
| Service role key not in env → password reset fails | Make password field optional + add clear 500 error: "Password reset unavailable (service role missing). Contact administrator." |
| Admin accidentally demotes themselves | Optional client-side guard: if `profile.id === authUserId && role !== 'admin'` show confirmation alert "You are about to remove your own admin privileges. Proceed?" |
| Dialog needs many fields, looks bad on mobile | Use simple 1-column responsive layout for DialogContent. |
| `auth.admin.updateUserById` throws if anon key used | Add a separate service-role client guarded by env presence; if env missing skip auth.admin call and only update profiles table fields. |
| Large Promise.all in loadData still has partial failures | Use per-promise try/catch (not a single try around Promise.all) so one failing query still leaves others loaded + visible error banner. |
