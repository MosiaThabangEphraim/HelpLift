import { createBrowserClient } from "@supabase/ssr"

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // Passkey (WebAuthn) sign-in is still flagged experimental in the Supabase
      // client, so it has to be switched on here. The Passkeys setting must also be
      // enabled in the Supabase dashboard (Authentication > Passkeys).
      auth: { experimental: { passkey: true } },
    }
  )
}
