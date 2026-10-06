"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { setOauthIntent, type OauthIntent } from "@/lib/oauth-intent"

// "Continue with Microsoft". Handled by Supabase Auth the same way Google
// and LinkedIn are (see google-sign-in-button.tsx) - the "Azure" provider
// enabled, with its client ID and secret, in the Supabase dashboard.
// Supabase's provider key for it is "azure" (Microsoft Entra ID/Azure AD),
// not "microsoft". This just starts the redirect; /auth/callback finishes
// it - the same route every provider uses, since almost nothing there is
// actually provider-specific.
export function MicrosoftSignInButton({
  label = "Continue with Microsoft",
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
      provider: "azure",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    // On success the browser is already leaving for Microsoft; only failures return here.
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
      className="flex w-full items-center justify-center gap-3 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-6 py-3.5 text-sm font-bold text-slate-800 dark:text-slate-100 shadow-sm transition-colors hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-60"
    >
      {isLoading ? (
        <Loader2 className="h-5 w-5 animate-spin" />
      ) : (
        <svg className="h-5 w-5" viewBox="0 0 23 23" aria-hidden="true">
          <rect x="1" y="1" width="10" height="10" fill="#F25022" />
          <rect x="12" y="1" width="10" height="10" fill="#7FBA00" />
          <rect x="1" y="12" width="10" height="10" fill="#00A4EF" />
          <rect x="12" y="12" width="10" height="10" fill="#FFB900" />
        </svg>
      )}
      <span>{label}</span>
    </button>
  )
}
