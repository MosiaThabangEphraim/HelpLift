"use client"

import { useEffect, useState } from "react"
import { Wifi, WifiOff } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

// Temporary, read-only offline mode. The service worker (public/sw.js) saves what
// people have viewed; this component does the page-side work:
//   * registers the service worker,
//   * shows an "offline / back online" banner,
//   * gives a clear message (instead of "Failed to fetch") when someone tries to
//     send, save, pay or upload while offline, and
//   * keeps saved private data private: it is deleted on sign-out, and when a
//     different person signs in on the same device.

const PRIVATE_CACHE_PREFIX = "helplift-private-"
const USER_KEY = "helplift:offline-user"
export const OFFLINE_ACTION_MESSAGE = "You're offline. This needs an internet connection, so please try again once you're back online."

async function clearPrivateData() {
  if (typeof caches === "undefined") return
  const keys = await caches.keys()
  await Promise.all(keys.filter(key => key.startsWith(PRIVATE_CACHE_PREFIX)).map(key => caches.delete(key)))
}

export function OfflineProvider() {
  const [online, setOnline] = useState(true)
  const [justReconnected, setJustReconnected] = useState(false)

  // 1. Service worker. Off in development (it would serve stale files and get in
  // the way of hot reload); set NEXT_PUBLIC_ENABLE_SW=true to try it there.
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return
    const enabled = process.env.NODE_ENV === "production" || process.env.NEXT_PUBLIC_ENABLE_SW === "true"
    if (!enabled) return
    navigator.serviceWorker.register("/sw.js").catch(() => undefined)
  }, [])

  // 2. Online / offline state
  useEffect(() => {
    setOnline(navigator.onLine)
    let timer: number | undefined
    const goOnline = () => {
      setOnline(true)
      setJustReconnected(true)
      timer = window.setTimeout(() => setJustReconnected(false), 3500)
    }
    const goOffline = () => setOnline(false)
    window.addEventListener("online", goOnline)
    window.addEventListener("offline", goOffline)
    return () => {
      window.removeEventListener("online", goOnline)
      window.removeEventListener("offline", goOffline)
      if (timer) window.clearTimeout(timer)
    }
  }, [])

  // Lets styles react to being offline if they ever need to.
  useEffect(() => {
    document.documentElement.classList.toggle("helplift-offline", !online)
  }, [online])

  // 3. Anything that changes data needs the internet. Fail with a clear sentence,
  // which the screens already show as the error message.
  useEffect(() => {
    const w = window as any
    if (w.__helpliftOfflineGuard) return
    w.__helpliftOfflineGuard = true
    const original = window.fetch.bind(window)
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const method = (init?.method || (typeof Request !== "undefined" && input instanceof Request ? input.method : "GET")).toUpperCase()
      if (!navigator.onLine && method !== "GET" && method !== "HEAD") {
        throw new Error(OFFLINE_ACTION_MESSAGE)
      }
      return original(input, init)
    }
  }, [])

  // 4. Saved private data belongs to one signed-in person. Delete it on sign-out,
  // and when a different person signs in on this device.
  useEffect(() => {
    const supabase = createClient()
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      try {
        if (event === "SIGNED_OUT") {
          await clearPrivateData()
          window.localStorage.removeItem(USER_KEY)
          return
        }
        const id = session?.user?.id
        if (id) {
          const previous = window.localStorage.getItem(USER_KEY)
          if (previous && previous !== id) await clearPrivateData()
          window.localStorage.setItem(USER_KEY, id)
        }
      } catch {
        // Storage or cache access can be blocked; nothing else to do.
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  if (online && !justReconnected) return null

  return (
    <div
      role="status"
      aria-live="polite"
      data-no-tip
      className={`fixed bottom-4 left-1/2 z-[9998] flex max-w-[92vw] -translate-x-1/2 items-center gap-2 rounded-full px-4 py-2.5 text-xs font-semibold shadow-lg ${
        online ? "bg-emerald-600 text-white" : "bg-amber-400 text-slate-900"
      }`}
    >
      {online ? <Wifi className="h-4 w-4 shrink-0" /> : <WifiOff className="h-4 w-4 shrink-0" />}
      <span>
        {online
          ? "Back online."
          : "You're offline. Showing saved data. Sending, saving and uploading are unavailable until you reconnect."}
      </span>
    </div>
  )
}
