"use client"

import { useEffect, useRef } from "react"
import { usePathname } from "next/navigation"
import { noteRouteChange } from "@/lib/route-history"

// Mounted once in the root layout: counts page-to-page navigations so
// <BackButton /> can tell whether there's somewhere in the site to go back to.
export function RouteHistoryTracker() {
  const pathname = usePathname()
  const previous = useRef<string | null>(null)

  useEffect(() => {
    if (previous.current !== null && previous.current !== pathname) noteRouteChange()
    previous.current = pathname
  }, [pathname])

  return null
}
