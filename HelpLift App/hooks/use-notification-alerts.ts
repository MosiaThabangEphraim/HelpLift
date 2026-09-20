"use client"

import { useEffect, useRef } from "react"
import { playNotificationSound, unlockNotificationSound } from "@/lib/notification-sound"

const POLL_INTERVAL_MS = 30_000

type Notice = { id: string; read_at: string | null }

// Keeps a dashboard's notifications fresh while it's open and chimes when a NEW
// unread one arrives. The first check only records what's already there, so
// opening the page never plays a sound for old notifications. Polling pauses
// while the tab is hidden and runs again as soon as it's shown.
export function useNotificationAlerts<T extends Notice>(setNotifications: (items: T[]) => void) {
  const known = useRef<Set<string> | null>(null)

  useEffect(() => {
    let cancelled = false

    const check = async () => {
      try {
        const res = await fetch("/api/notifications", { cache: "no-store" })
        if (!res.ok || cancelled) return
        const items: T[] = (await res.json()).notifications || []

        if (known.current === null) {
          known.current = new Set(items.map(item => item.id))
          return
        }
        const fresh = items.filter(item => !known.current!.has(item.id) && !item.read_at)
        items.forEach(item => known.current!.add(item.id))
        if (fresh.length > 0) {
          setNotifications(items)
          playNotificationSound()
        }
      } catch {
        // Offline or a hiccup: try again on the next tick.
      }
    }

    check()
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") check()
    }, POLL_INTERVAL_MS)
    const onVisible = () => { if (document.visibilityState === "visible") check() }
    document.addEventListener("visibilitychange", onVisible)

    // Browsers only allow sound after the person has interacted with the page.
    const unlock = () => unlockNotificationSound()
    window.addEventListener("pointerdown", unlock, { once: true })
    window.addEventListener("keydown", unlock, { once: true })

    return () => {
      cancelled = true
      window.clearInterval(timer)
      document.removeEventListener("visibilitychange", onVisible)
      window.removeEventListener("pointerdown", unlock)
      window.removeEventListener("keydown", unlock)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
