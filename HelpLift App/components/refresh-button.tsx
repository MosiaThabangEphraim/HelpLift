"use client"

import { useState } from "react"
import { RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

// Reloads a page's data in place (no full page reload, so the current tab,
// filters and any half-filled form stay as they are). "icon" matches the round
// header buttons on the dashboards; "pill" is a small labelled button for the
// public pages. Spins while loading and confirms with a short toast.
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
      toast.success("Up to date", { duration: 1500 })
    } catch {
      toast.error("Couldn't refresh - check your connection and try again.")
    } finally {
      // Keep the spin visible briefly so a fast refresh still registers.
      window.setTimeout(() => setIsRefreshing(false), Math.max(0, 500 - (Date.now() - started)))
    }
  }

  const icon = <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />

  if (variant === "pill") {
    return (
      <button
        type="button"
        onClick={refresh}
        disabled={isRefreshing}
        aria-label="Refresh"
        data-tip="Load the latest updates"
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-70 transition-colors",
          className
        )}
      >
        {icon}
        {isRefreshing ? "Refreshing..." : "Refresh"}
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
        "inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-70 transition-colors",
        className
      )}
    >
      {icon}
    </button>
  )
}
