import { createClient } from "@supabase/supabase-js"

// Service-role client. Bypasses RLS, so only use it in server routes that have
// already authorized the caller themselves (team invitations, the public invite
// lookup). Never import this from client components.
export function createAdminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
