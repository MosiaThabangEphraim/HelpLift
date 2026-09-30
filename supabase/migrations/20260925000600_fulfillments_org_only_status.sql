-- Migration: 20260925000600_fulfillments_org_only_status.sql
-- Description: Only the organization (the recipient of a delivery or a
-- claimed gift) may change a fulfillment's status - start it, mark it
-- delivered/completed, or attach proof. A giver self-declaring "delivered"
-- without the recipient confirming receipt is a weaker signal than the org
-- confirming it arrived. The giver keeps full read access and can still
-- message the org at any time; they just no longer have their own
-- start/complete buttons (removed from app/givers-dashboard/page.tsx to
-- match - this migration is the real enforcement, that's just the UI).

drop policy if exists "Givers can update their fulfillments" on public.fulfillments;
