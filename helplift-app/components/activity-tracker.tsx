"use client"

import { useEffect, useRef } from "react"
import { usePathname } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

// Records signed-in users' activity for the admin Live activity tab - see
// app/api/activity. Mounted once in the root layout:
// - a page view on every navigation,
// - a once-a-minute heartbeat while the tab is visible (for "online now"),
// - every successful change made through an /api route (POST/PATCH/PUT/DELETE),
//   which the server turns into a label like "Updated their profile"
//   (lib/activity-labels.ts) - only the method and route are sent, never
//   the request or its contents,
// - small in-page actions reported with logClientAction() (settings
//   switched, theme changed, tab opened...).
// Signed-out visitors are never tracked. Best-effort: failures are silent
// and never affect the page.

const HEARTBEAT_MS = 60_000

// Kept up to date by ActivityTracker, so the helpers below don't send
// anything for signed-out visitors.
let signedIn = false

type Payload =
  | { event: "page_view" | "heartbeat" | "signed_out"; path: string }
  | { event: "ui_action"; path: string; action: string; detail?: string }
  | { event: "api_action"; path: string; method: string; api: string }

// The original fetch, so our own reports never pass through the reporter below.
let rawFetch: typeof fetch | null = null

function send(payload: Payload) {
  return (rawFetch || fetch)("/api/activity", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => {})
}

const currentPath = () => (typeof window !== "undefined" ? window.location.pathname : "/")

// Call just before signing out in the browser, so the sign-out shows in the log.
export function recordSignOut() {
  return send({ event: "signed_out", path: currentPath() })
}

/** Logs a small in-page action, e.g. logClientAction("Turned click sounds on"). */
export function logClientAction(action: string, detail?: string) {
  if (!signedIn) return
  send({ event: "ui_action", path: currentPath(), action, detail })
}

// Routes that are never reported: the tracker itself, uploads (the action
// they belong to is logged instead), and background/sign-in traffic.
const IGNORED_API = /^\/api\/(activity|uploads|public\/track-visit|public\/grammar|public\/payfast|public\/paypal|webhooks|login|logout|register$|developer-reports)/

function apiPathOf(input: RequestInfo | URL): string | null {
  try {
    const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url
    const url = new URL(raw, window.location.origin)
    if (url.origin !== window.location.origin || !url.pathname.startsWith("/api/")) return null
    return url.pathname
  } catch {
    return null
  }
}

export function ActivityTracker() {
  const pathname = usePathname()
  const signedInRef = useRef(false)

  // Know whether someone is signed in (and keep up as they sign in/out).
  useEffect(() => {
    const supabase = createClient()
    const set = (value: boolean) => { signedInRef.current = value; signedIn = value }
    supabase.auth.getSession().then(({ data }) => set(!!data.session))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => set(!!session))
    return () => listener.subscription.unsubscribe()
  }, [])

  // Report successful changes made through the API.
  useEffect(() => {
    if (rawFetch) return
    const original = window.fetch.bind(window)
    rawFetch = original
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const response = await original(input, init)
      try {
        const method = (init?.method || (input instanceof Request ? input.method : "GET")).toUpperCase()
        if (signedIn && response.ok && method !== "GET" && method !== "HEAD") {
          const api = apiPathOf(input)
          if (api && !IGNORED_API.test(api)) send({ event: "api_action", path: currentPath(), method, api })
        }
      } catch {
        // Never let reporting get in the way of the real request.
      }
      return response
    }
    return () => {
      window.fetch = original
      rawFetch = null
    }
  }, [])

  // A page view on every navigation.
  useEffect(() => {
    if (!pathname) return
    // Give the session check above a moment on the very first page.
    const timer = window.setTimeout(() => { if (signedInRef.current) send({ event: "page_view", path: pathname }) }, 600)
    return () => window.clearTimeout(timer)
  }, [pathname])

  // Heartbeat while the tab is visible.
  useEffect(() => {
    const beat = () => {
      if (signedInRef.current && document.visibilityState === "visible") send({ event: "heartbeat", path: window.location.pathname })
    }
    const interval = window.setInterval(beat, HEARTBEAT_MS)
    return () => window.clearInterval(interval)
  }, [])

  return null
}
