"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"
import { noteRoute } from "@/lib/route-history"

// Mounted once in the root layout: records page-to-page navigations so
// <BackButton /> can tell whether there's somewhere in the site to go back to.
export function RouteHistoryTracker() {
  const pathname = usePathname()

  useEffect(() => {
    noteRoute(pathname)
  }, [pathname])

  return null
}
