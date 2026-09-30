"use client"

import { useEffect, useState } from "react"
import { useTheme } from "next-themes"
import { Contrast, Moon, Palette, Sun } from "lucide-react"

type Mode = "light" | "dark" | "high-contrast" | "grayscale"

// Each mode's icon/label describes what clicking switches TO, not the
// current mode - matches the original light/dark-only behavior exactly
// (showing dark → Sun/"Switch to light", showing light → Moon/"Switch to
// dark"), just extended with more stops in the same cycle.
const NEXT: Record<Mode, Mode> = { light: "dark", dark: "high-contrast", "high-contrast": "grayscale", grayscale: "light" }
const ICON: Record<Mode, typeof Sun> = { light: Moon, dark: Contrast, "high-contrast": Palette, grayscale: Sun }
const LABEL: Record<Mode, string> = {
  light: "Switch to dark mode",
  dark: "Switch to high-contrast mode",
  "high-contrast": "Switch to grayscale mode",
  grayscale: "Switch to light mode",
}

/**
 * Light / dark / high-contrast / grayscale toggle, reusable across every
 * page. Backed by next-themes' single global provider (app/layout.tsx,
 * themes=["light", "dark", "high-contrast", "grayscale"]), so flipping it
 * here - or on the public navbar, which has its own copy of this control -
 * updates the theme everywhere at once; there's only one theme value for the
 * whole app. See app/globals.css's ".high-contrast"/".grayscale" blocks for
 * what those two modes change.
 */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  const current: Mode = !mounted ? "dark" : ((resolvedTheme as Mode) || "light")
  const Icon = ICON[current]

  return (
    <button
      type="button"
      onClick={() => setTheme(NEXT[current])}
      aria-label={LABEL[current]}
      data-tip={LABEL[current]}
      className={`inline-flex items-center justify-center rounded-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors ${className}`}
    >
      <Icon className="w-4 h-4" />
    </button>
  )
}
