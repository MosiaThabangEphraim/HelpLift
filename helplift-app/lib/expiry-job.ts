import { createAdminClient } from "@/lib/supabase/admin"

// Server-only safety net for the daily public.expire_overdue_items() job
// (see lib/expiry.ts): run from the public Needs board and Gift Library APIs,
// at most every 30 minutes per server instance. Never throws.

const EVERY_MS = 30 * 60 * 1000
let lastRun = 0

export async function expireOverdueItems() {
  if (Date.now() - lastRun < EVERY_MS) return
  lastRun = Date.now()
  try {
    const { error } = await createAdminClient().rpc("expire_overdue_items")
    if (error) console.warn("Expiry job warning (has 20261008000300_expire_overdue_needs_and_gifts.sql been applied?):", error.message)
  } catch (error) {
    console.warn("Expiry job warning:", error)
  }
}
