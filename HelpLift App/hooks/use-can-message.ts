"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"

// Whether the current visitor can send messages, for pages that offer a
// "Message" button (organization directory and profile pages).
//   signedIn   - has an account and is logged in
//   canMessage - allowed to send: everyone signed in, except an organization
//                viewer, who is read-only. (The database enforces this too.)
export function useCanMessage() {
  const [state, setState] = useState({ signedIn: false, canMessage: false, isViewer: false })

  useEffect(() => {
    const supabase = createClient()
    const check = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
        let isViewer = false
        if (profile?.role === "organization") {
          const { data: membership } = await supabase.from("organization_members").select("role").eq("profile_id", user.id).maybeSingle()
          isViewer = membership?.role === "viewer"
        }
        setState({ signedIn: true, canMessage: !isViewer, isViewer })
      } catch (err) {
        console.warn("Session check fallback:", err)
      }
    }
    check()
  }, [])

  return state
}
