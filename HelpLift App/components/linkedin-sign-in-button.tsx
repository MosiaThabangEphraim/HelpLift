"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { setOauthIntent, type OauthIntent } from "@/lib/oauth-intent"

// "Continue with LinkedIn". Handled by Supabase Auth the same way Google is
// (see google-sign-in-button.tsx) - the "LinkedIn (OIDC)" provider enabled,
// with its client ID and secret, in the Supabase dashboard. Supabase's
// provider key for it is "linkedin_oidc" (the older "linkedin" OAuth 2.0
// provider is deprecated). This just starts the redirect; /auth/callback
// finishes it - the same route Google uses, since almost nothing there is
// actually Google-specific.
export function LinkedInSignInButton({
  label = "Continue with LinkedIn",
  intent,
  onError,
  disabled = false,
}: {
  label?: string
  /** Where the person started: "org" / "giver" = they already picked a type on the Register page, "admin" = the admin portal. */
  intent?: OauthIntent
  onError?: (message: string) => void
  /** e.g. registration's "agree to the terms" checkbox not checked yet. */
  disabled?: boolean
}) {
  const [isLoading, setIsLoading] = useState(false)

  const start = async () => {
    setIsLoading(true)
    setOauthIntent(intent)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "linkedin_oidc",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    // On success the browser is already leaving for LinkedIn; only failures return here.
    if (error) {
      setIsLoading(false)
      onError?.(error.message)
    }
  }

  return (
    <button
      type="button"
      onClick={start}
      disabled={isLoading || disabled}
      className="flex w-full items-center justify-center gap-3 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-6 py-3.5 text-sm font-bold text-slate-800 dark:text-slate-100 shadow-sm transition-colors hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-60"
    >
      {isLoading ? (
        <Loader2 className="h-5 w-5 animate-spin" />
      ) : (
        <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
          <rect width="24" height="24" rx="4" fill="#0A66C2" />
          <path
            fill="#fff"
            d="M7.12 9.4H4.4V19.5h2.72V9.4zM5.76 4.5a1.58 1.58 0 1 0 0 3.15 1.58 1.58 0 0 0 0-3.15zM19.6 19.5h-2.72v-5.3c0-1.26-.02-2.88-1.76-2.88-1.76 0-2.03 1.37-2.03 2.79v5.39H10.4V9.4h2.6v1.38h.04c.36-.68 1.25-1.4 2.58-1.4 2.76 0 3.98 1.82 3.98 4.4v5.72z"
          />
        </svg>
      )}
      <span>{label}</span>
    </button>
  )
}
