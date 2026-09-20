"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

// "Continue with Google". Google sign-in is handled by Supabase Auth (the Google
// provider is enabled, with the client ID and secret, in the Supabase
// dashboard). This just starts the redirect; /auth/callback finishes it.
export function GoogleSignInButton({
  label = "Continue with Google",
  intent,
  onError,
}: {
  label?: string
  /** Where the person started: "org" / "giver" = they already picked a type on the Register page, "admin" = the admin portal. */
  intent?: "org" | "giver" | "admin"
  onError?: (message: string) => void
}) {
  const [isLoading, setIsLoading] = useState(false)

  const start = async () => {
    setIsLoading(true)
    // Read (and cleared) by /auth/callback once Google sends the person back.
    document.cookie = intent
      ? `google_intent=${intent}; path=/; max-age=600; SameSite=Lax`
      : "google_intent=; path=/; max-age=0; SameSite=Lax"
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        // Always let the person pick which Google account to use.
        queryParams: { prompt: "select_account" },
      },
    })
    // On success the browser is already leaving for Google; only failures return here.
    if (error) {
      setIsLoading(false)
      onError?.(error.message)
    }
  }

  return (
    <button
      type="button"
      onClick={start}
      disabled={isLoading}
      className="flex w-full items-center justify-center gap-3 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-6 py-3.5 text-sm font-bold text-slate-800 dark:text-slate-100 shadow-sm transition-colors hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-60"
    >
      {isLoading ? (
        <Loader2 className="h-5 w-5 animate-spin" />
      ) : (
        <svg className="h-5 w-5" viewBox="0 0 48 48" aria-hidden="true">
          <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
          <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
          <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
          <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
        </svg>
      )}
      <span>{label}</span>
    </button>
  )
}
