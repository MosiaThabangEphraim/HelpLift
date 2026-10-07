"use client"

import { useEffect } from "react"
import { applyFontSizeLevel, getFontSizeLevel } from "@/lib/font-size"

// Applies the saved "larger text" preference (see lib/font-size.ts) once on
// every page load - mounted once in the root layout, same pattern as
// OfflineProvider/RouteHistoryTracker. Renders nothing itself.
export function FontSizeProvider() {
  useEffect(() => {
    applyFontSizeLevel(getFontSizeLevel())
  }, [])
  return null
}
