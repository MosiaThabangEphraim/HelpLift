import { createAdminClient } from "@/lib/supabase/admin"

// Google, LinkedIn and Microsoft are sign-in only, but a provider still
// creates an account the moment someone approves it. The sign-in callback
// deletes it straight away when there's no registered account; as a safety
// net, any unfinished account left behind is deleted after 30 minutes by public.delete_unfinished_signups() (see
// 20261008000100_unfinished_signup_cleanup.sql) - on a pg_cron schedule, and
// also from here whenever someone signs in or registers, so it works even
// without pg_cron. At most once every 10 minutes per server instance.
// Best-effort: never throws.

const EVERY_MS = 10 * 60 * 1000
let lastRun = 0

export async function cleanUpUnfinishedSignups() {
  if (Date.now() - lastRun < EVERY_MS) return
  lastRun = Date.now()
  try {
    const { error } = await createAdminClient().rpc("delete_unfinished_signups")
    if (error) console.warn("Unfinished sign-up clean-up warning (has 20261008000100_unfinished_signup_cleanup.sql been applied?):", error.message)
  } catch (error) {
    console.warn("Unfinished sign-up clean-up warning:", error)
  }
}
