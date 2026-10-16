"use client"

import { useEffect } from "react"
import { useTheme } from "next-themes"
import { createClient } from "@/lib/supabase/client"
import { getSessionUser } from "@/lib/session-user"

// Visitors who aren't signed in always see HelpLift in light mode - there's no
// theme switch on the public pages. Signed-in members choose their theme in
// Settings -> User interface. When a member signs out, their choice is put
// aside (MEMBER_THEME_KEY) and the site goes back to light; when they sign in
// again on this device, their choice is restored. Mounted once in the root
// layout, inside the ThemeProvider.

const MEMBER_THEME_KEY = "helplift:member-theme"

export function SignedOutLightTheme() {
  const { theme, setTheme } = useTheme()

  useEffect(() => {
    const supabase = createClient()
    let current = theme

    const apply = (signedIn: boolean) => {
      try {
        // next-themes keeps the live choice under "theme" - it may have changed in Settings since mount.
        current = window.localStorage.getItem("theme") || current
        if (!signedIn) {
          if (current && current !== "light") {
            window.localStorage.setItem(MEMBER_THEME_KEY, current)
            setTheme("light")
            current = "light"
          }
          return
        }
        const saved = window.localStorage.getItem(MEMBER_THEME_KEY)
        if (saved) {
          window.localStorage.removeItem(MEMBER_THEME_KEY)
          if (current === "light") {
            setTheme(saved)
            current = saved
          }
        }
      } catch {
        // Storage blocked: nothing to put aside or restore.
        if (!signedIn && current !== "light") setTheme("light")
      }
    }

    getSessionUser(supabase).then(({ data: { user } }) => apply(!!user)).catch(() => apply(false))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => apply(!!session))
    return () => subscription.unsubscribe()
    // Runs once; it tracks the theme itself through `current`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}
