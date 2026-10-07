"use client"

import { useState } from "react"
import { logClientAction } from "@/components/activity-tracker"

// Smooth tab transitions for the dashboards: the newly opened tab's content
// fades in and slides from the side you're moving towards - from the right
// for a tab further along `order`, from the left for an earlier one. Radix
// mounts a tab's content each time it opens, so the entrance animation plays
// on every switch. Switched off by the Reduce motion setting
// (lib/reduce-motion.ts) and by the device's own reduced-motion preference.
//
// Usage: const { changeTab, tabMotion } = useTabTransition(ORDER, activeTab, setActiveTab)
//        <Tabs value={activeTab} onValueChange={changeTab}> ... <TabsContent className={tabMotion}>
export function useTabTransition(order: readonly string[], activeTab: string, setActiveTab: (tab: any) => void) {
  const [direction, setDirection] = useState<"forward" | "back">("forward")

  const changeTab = (next: string) => {
    if (next === activeTab) return
    const from = order.indexOf(activeTab)
    const to = order.indexOf(next)
    setDirection(to >= from ? "forward" : "back")
    setActiveTab(next)
    // "gift-library" -> "Gift library"
    const name = next.replace(/[-_]/g, " ")
    logClientAction(`Opened the ${name.charAt(0).toUpperCase()}${name.slice(1)} tab`)
  }

  const tabMotion = `animate-in fade-in duration-300 ease-out motion-reduce:animate-none ${direction === "forward" ? "slide-in-from-right-4" : "slide-in-from-left-4"}`

  return { changeTab, tabMotion }
}
