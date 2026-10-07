"use client"

import { useEffect, useRef, useState } from "react"
import { Maximize2, Minimize2 } from "lucide-react"

// Maximize/restore for the hand-built pop-up windows (pledge a gift, express
// interest, sign-in prompts...) that don't use components/ui/dialog.tsx, which
// has this built in. Put it as the FIRST child of the window's panel: it
// switches the panel itself to full screen and back. The panel needs
// `relative` and some top padding (pt-12) so the button has room.
//
// Kept as whole strings so Tailwind generates every class.
const MAXIMIZED_CLASSES = [
  "fixed", "inset-0", "z-[60]", "max-w-none", "sm:max-w-none", "lg:max-w-none",
  "h-[100dvh]", "max-h-[100dvh]", "rounded-none", "border-0",
]

export function MaximizeToggle() {
  const buttonRef = useRef<HTMLButtonElement>(null)
  const savedClasses = useRef<string[]>([])
  const [maximized, setMaximized] = useState(false)

  useEffect(() => {
    const panel = buttonRef.current?.parentElement
    if (!panel) return
    if (maximized) {
      // Take off the panel's own size/shape classes (they'd clash with the
      // full-screen ones) and remember them for restoring.
      savedClasses.current = Array.from(panel.classList).filter(name => /^(?:(?:sm|md|lg):)?(?:max-w-|max-h-|rounded)/.test(name))
      panel.classList.remove(...savedClasses.current)
      panel.classList.add(...MAXIMIZED_CLASSES)
    } else if (savedClasses.current.length) {
      panel.classList.remove(...MAXIMIZED_CLASSES)
      panel.classList.add(...savedClasses.current)
      savedClasses.current = []
    }
  }, [maximized])

  const label = maximized ? "Restore size" : "Maximize"
  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={() => setMaximized(m => !m)}
      aria-label={label}
      aria-pressed={maximized}
      data-tip={label}
      className="absolute top-3 right-3 z-10 rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-[#1A2740] dark:hover:text-slate-300"
    >
      {maximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
    </button>
  )
}
