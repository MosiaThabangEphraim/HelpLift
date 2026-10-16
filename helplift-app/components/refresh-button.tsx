"use client"

import { useState } from "react"
import { logClientAction } from "@/components/activity-tracker"
import { RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

// Reloads a page's data in place (no full page reload, so the current tab,
// filters and any half-filled form stay as they are). "icon" is a quiet icon
// button (dashboard headers and admin panels); "pill" is a small labelled one
// for the public pages. Both are borderless and only shaded on hover. Spins
// while loading and confirms with a short toast.
export function RefreshButton({
  onRefresh,
  variant = "icon",
  className,
}: {
  onRefresh: () => unknown | Promise<unknown>
  variant?: "icon" | "pill"
  className?: string
}) {
  const [isRefreshing, setIsRefreshing] = useState(false)

  const refresh = async () => {
    if (isRefreshing) return
    setIsRefreshing(true)
    const started = Date.now()
    try {
      await onRefresh()
      logClientAction("Refreshed the page")
      toast.success("Up to date", { duration: 1500 })
    } catch {
      toast.error("Couldn't refresh - check your connection and try again.")
    } finally {
      // Keep the spin visible briefly so a fast refresh still registers.
      window.setTimeout(() => setIsRefreshing(false), Math.max(0, 500 - (Date.now() - started)))
    }
  }

  const icon = <RefreshCw className={cn(variant === "pill" ? "h-3.5 w-3.5" : "h-4 w-4", isRefreshing && "animate-spin")} />

  if (variant === "pill") {
    return (
      <button
        type="button"
        onClick={refresh}
        disabled={isRefreshing}
        aria-label="Refresh"
        data-tip="Load the latest updates"
        className={cn(
          "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-white/5 dark:hover:text-white disabled:opacity-70 transition-colors",
          className
        )}
      >
        {icon}
        Refresh
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={refresh}
      disabled={isRefreshing}
      aria-label="Refresh"
      data-tip="Load the latest updates"
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-white/5 dark:hover:text-white disabled:opacity-70 transition-colors",
        className
      )}
    >
      {icon}
    </button>
  )
}
