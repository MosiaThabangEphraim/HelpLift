# Need Draft Visibility & Admin Approval Implementation Plan

## Repository Research

### Current Architecture & Data Model
- **Database**: Supabase (PostgreSQL with RLS policies)
- **Need Status Enum**: `draft` → `open` → `fulfilled` / `closed`
- **Admin Helper**: `public.is_admin()` function checks profile role = 'admin'
- **Backend APIs**: Next.js Route Handlers under `Frontend/app/api/`
- **Frontend Dashboards**: Organization dashboard (`organisation-dashboard/page.tsx`), Admin dashboard (`admin-dashboard/page.tsx`)

### Current Problems Identified
1. **Draft needs not visible to org**: In [organisation-dashboard/page.tsx](file:///c:/Users/mosia/HelpLift/Frontend/app/organisation-dashboard/page.tsx#L128-L134) the `loadData()` function selects the `urgency` column with NO fallback. If migration 0012 (adds urgency) hasn't run or there's any column mismatch, the entire query returns `null` → `needs = []` → drafts don't appear. Compare with [POST /api/organization/needs](file:///c:/Users/mosia/HelpLift/Frontend/app/api/organization/needs/route.ts#L36-L42) which HAS an urgency fallback.

2. **Organization can bypass admin approval**: In [PATCH /api/organization/needs/[id]](file:///c:/Users/mosia/HelpLift/Frontend/app/api/organization/needs/%5Bid%5D/route.ts#L13-L17) if the organization's `verification_status === 'approved'`, an organization user can directly set `status = 'open'` (line 14 allows `"open"` in the allowed array) — this skips admin approval entirely.

3. **RLS policy is permissive**: The current RLS in [0005_organization_approval_rules.sql](file:///c:/Users/mosia/HelpLift/supabase/migrations/20260914000500_organization_approval_rules.sql) and [0010_publish_requires_approval.sql](file:///c:/Users/mosia/HelpLift/supabase/migrations/20260914001000_publish_requires_approval.sql) only block an UNAPPROVED org from setting status='open'. An APPROVED org can still directly publish without a need-level admin check.

4. **UI has direct "Publish need" button**: In [organisation-dashboard/page.tsx](file:///c:/Users/mosia/HelpLift/Frontend/app/organisation-dashboard/page.tsx#L553-L565) — when org is approved, it shows "Publish need" which calls the org PATCH endpoint with `status='open'`. This contradicts the "admin must approve" requirement.

5. **Admin dashboard works but labels unclear**: In [admin-dashboard/page.tsx](file:///c:/Users/mosia/HelpLift/Frontend/app/admin-dashboard/page.tsx#L257-L278), for drafts there's a "Publish" button (works via admin PATCH endpoint) — but button should explicitly say "Approve & Publish" to reflect the workflow.

### What Already Works Correctly
- **Public needs API** ([GET /api/public/needs](file:///c:/Users/mosia/HelpLift/Frontend/app/api/public/needs/route.ts#L18)): Only returns `status = 'open'` needs. No change needed here.
- **Needs CREATE API**: Always saves with `status: "draft"` (correct).
- **Admin PATCH needs endpoint** ([admin/needs/[id]/route.ts](file:///c:/Users/mosia/HelpLift/Frontend/app/api/admin/needs/%5Bid%5D/route.ts#L12-L16)): Admin can set `open|fulfilled|closed` (correct).
- **Admin RLS view-all policy** ([0004_admin_policies.sql](file:///c:/Users/mosia/HelpLift/supabase/migrations/20260914000400_admin_policies.sql#L30-L37)): Admin already sees ALL needs (including drafts).

---

## Files and Modules

| File | Expected Change |
|------|-----------------|
| `Frontend/app/organisation-dashboard/page.tsx` | Add urgency query fallback in `loadData()` (like POST API has); change draft status section: remove "Publish need" button for org, always show an "Awaiting admin approval" message. |
| `Frontend/app/api/organization/needs/[id]/route.ts` | Remove `"open"` from allowed status array for org-level PATCH; only allow org to set `closed`/`fulfilled` (cannot publish directly). |
| `supabase/migrations/20260914001300_need_admin_approval_lock.sql` | NEW migration: drop + recreate "Organizations can update their needs" policy with a `with check` that explicitly prevents org users from transitioning status to `open` (only admins via admin policy can do that). |
| `Frontend/app/admin-dashboard/page.tsx` | In `NeedsView`, relabel the draft "Publish" button to "Approve & Publish" and visually highlight draft needs as pending review. |

---

## Implementation Steps (Dependency Order)

1. **Step 1 — Database: Lock down RLS so orgs cannot set status='open'**
   - Create new migration `20260914001300_need_admin_approval_lock.sql`
   - Logic: for org-owned UPDATE policy, `with check` clause must require that if status is changing TO `'open'`, the actor is admin (i.e. allow `status <> 'open'` for org, `'open'` only via admin policy)
   - Since Supabase RLS uses "any policy allows" semantics, the existing admin policy already permits admins to set any status, so we only need to RESTRICT the org policy.

2. **Step 2 — API: Remove "open" from org PATCH endpoint's allowed list**
   - In `route.ts` line 14 change allowed array from `["open", "closed", "fulfilled"]` to `["closed", "fulfilled"]`.
   - Update or remove the `verification_status` check since it's no longer needed for publishing (only admin publishes).

3. **Step 3 — Org Dashboard: Fix urgency fallback for the direct needs SELECT**
   - Mirror the retry pattern already used in the POST API: first query with urgency; on error containing "urgency", re-query WITHOUT urgency and map `urgency: "medium"` onto results.
   - Ensure the `.select()` and error handling matches the defensive pattern in POST route lines 36-42.

4. **Step 4 — Org Dashboard UI: Replace direct publish with admin-approval messaging**
   - In `needs.map()` render (around line 553):
     - Remove the conditional "Publish need" button entirely from the org dashboard
     - If `need.status === "draft"`: always show a badge/message like "Draft — submitted for admin review. An administrator must approve this need before it appears publicly."
     - Keep the "Close need" button available for status="open" (so org can still close their own live listings).

5. **Step 5 — Admin Dashboard: Improve Approve button clarity**
   - In `NeedsView` around line 271: Change `Publish` button text to `Approve & Publish` for `status === "draft"`.
   - Optionally add a visual indicator (e.g. amber badge) highlighting draft needs awaiting review.

6. **Step 6 — Verification: Confirm public API still only shows open needs**
   - No code change; just re-check `public/needs/route.ts` still has `.eq("status", "open")` and that the RLS "Anyone can view open needs" policy remains intact.

---

## Dependencies and Considerations
- **Migration order**: The new migration must come after 0010 since it replaces the policy created there.
- **Idempotency**: Migration must use `drop policy if exists` before recreating to avoid errors on re-run.
- **No new status enum needed**: Using `draft` (submitted, awaiting approval) and `open` (approved, public) works. Admin changes `draft → open` = "approve".
- **Existing data**: Any needs currently in `open` state stay `open` (backwards compatible). Any `draft` needs become admin-approval-gated, which is the intended fix.
- **Error consistency**: Org PATCH endpoint returns 400 if a sneaky org user tries to manually POST status=open via raw HTTP; we rely on BOTH API check AND RLS check as defense-in-depth.

---

## Validation
1. **Organization test path**:
   - Log in as organization, create a need → see it appear in "Your needs" list with "draft" status, and see "Awaiting admin approval" message (no Publish button).
   - Try calling the org PATCH API manually with `{status: "open"}` → expect HTTP 400/403.
2. **Admin test path**:
   - Log in as admin → Moderation dashboard → Needs tab → see all draft needs listed.
   - Click "Approve & Publish" on a draft → status becomes `open`.
3. **Public listing verification**:
   - Visit public needs page → confirm only the admin-approved (status=open) needs show up; the draft does NOT appear.
4. **RLS smoke test**: Try bypassing API with direct Supabase call as org user setting status=open → should fail (new RLS check).
5. **Run diagnostics**: `GetDiagnostics` on the edited TSX/TS files for type errors.

---

## Risks
| Risk | Handling |
|------|----------|
| Migration fails if policy already dropped by earlier run | Use `drop policy if exists` before `create policy` — idempotent. |
| Org users had bookmarked direct publish HTTP calls | Defense-in-depth: BOTH API route rejects open AND RLS rejects open. Old direct calls fail safely. |
| Existing approved orgs were used to instant publishing | UI messaging clearly explains "Admin approval required" on every draft. Backwards compatible: any already-open needs stay open. |
| Urgency fallback still returns nothing if a different column is broken | If both queries fail, `setNeeds([])` runs; also set visible error banner so org knows data load failed. |
