"use client"

import { useEffect } from "react"
import { applyReduceMotion, getReduceMotion } from "@/lib/reduce-motion"

// Applies the saved "Reduce motion" preference (see lib/reduce-motion.ts) once
// on every page load - mounted once in the root layout, same pattern as
// FontSizeProvider. Renders nothing itself.
export function ReduceMotionProvider() {
  useEffect(() => {
    applyReduceMotion(getReduceMotion())
  }, [])
  return null
}
