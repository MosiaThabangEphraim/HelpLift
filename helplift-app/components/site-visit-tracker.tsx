"use client"

import { useEffect } from "react"

// First-party, cost-free site-visit tracking (see 20260928000600_site_visits.sql)
// for the admin Reports tab - no third-party analytics service involved.
// Mounted once in the root layout, same pattern as OfflineProvider/
// RouteHistoryTracker. Records at most one row per browser tab per visit:
//
// - visitorId lives in localStorage, so it survives across sessions and lets
//   the same person's repeat visits count once toward "unique visitors."
// - sessionId lives in sessionStorage, so a page refresh or client-side
//   navigation within the same tab never counts as a second visit; a new
//   tab (or the same tab after being closed and reopened) does.
//
// Best-effort throughout: storage can be blocked (private windows) and the
// request can fail - neither should ever affect the page itself.
const VISITOR_KEY = "helplift:visitor-id"
const SESSION_KEY = "helplift:session-id"

function randomId(): string {
  try {
    return crypto.randomUUID()
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`
  }
}

function getOrCreate(storage: Storage, key: string): string {
  const existing = storage.getItem(key)
  if (existing) return existing
  const created = randomId()
  storage.setItem(key, created)
  return created
}

export function SiteVisitTracker() {
  useEffect(() => {
    try {
      if (window.sessionStorage.getItem(SESSION_KEY)) return // already recorded this tab's visit
      const sessionId = getOrCreate(window.sessionStorage, SESSION_KEY)
      const visitorId = getOrCreate(window.localStorage, VISITOR_KEY)
      fetch("/api/public/track-visit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitorId, sessionId, path: window.location.pathname }),
        keepalive: true,
      })
        .then(res => {
          // A silent failure here is exactly what made this hard to
          // diagnose the first time around - this doesn't change behavior,
          // it just makes a real failure visible in devtools instead of
          // invisible.
          if (!res.ok) res.json().then(body => console.warn("Site-visit tracking failed:", body?.message || res.status)).catch(() => console.warn("Site-visit tracking failed:", res.status))
        })
        .catch(err => console.warn("Site-visit tracking request failed:", err))
    } catch {
      // Storage blocked or unavailable - just skip tracking this visit.
    }
  }, [])

  return null
}
