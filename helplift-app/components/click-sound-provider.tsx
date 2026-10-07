"use client"

import { useEffect } from "react"
import { isClickSoundEnabled, onClickSoundChange, playClickSound, type ClickSoundKind } from "@/lib/click-sounds"

// Plays the optional click sounds (lib/click-sounds.ts) for presses on anything
// interactive, anywhere on the site - one listener on the document, mounted
// once in the root layout. Each kind of control gets its own sound (see
// soundFor); disabled controls stay silent. Renders nothing.

const INTERACTIVE = [
  "button",
  "a[href]",
  "summary",
  "select",
  'input[type="checkbox"]',
  'input[type="radio"]',
  'input[type="submit"]',
  'input[type="button"]',
  '[role="button"]',
  '[role="tab"]',
  '[role="switch"]',
  '[role="checkbox"]',
  '[role="menuitem"]',
  '[role="option"]',
].join(",")

// Whole words only, so e.g. "Send" doesn't count as "end" or "Feedback" as "back".
const DISMISS_WORDS = /\b(close|cancel|dismiss|back|skip|not now|end)\b/i
const DANGER_WORDS = /\b(delete|remove|reject|decline|suspend|sign out|log out|unpublish)\b/i
const DANGER_CLASSES = /\b(bg|text)-red-\d/
const PRIMARY_CLASSES = /\bbg-(blue|emerald|purple|pink)-600\b/

// Which sound fits this control. Checked at click time, before the control
// changes - so a switch that's currently off is being turned on.
function soundFor(el: HTMLElement): ClickSoundKind {
  const role = el.getAttribute("role")
  const tag = el.tagName
  const label = `${el.getAttribute("aria-label") || ""} ${el.textContent || ""}`.trim().slice(0, 80)
  const classes = typeof el.className === "string" ? el.className : ""

  if (role === "tab") return "tab"
  if (role === "switch" || role === "checkbox") return el.getAttribute("aria-checked") === "true" ? "toggle-off" : "toggle-on"
  if (tag === "INPUT" && ((el as HTMLInputElement).type === "checkbox" || (el as HTMLInputElement).type === "radio")) {
    return (el as HTMLInputElement).checked ? "toggle-off" : "toggle-on"
  }
  if (role === "menuitem" || role === "option" || tag === "SELECT") return "select"
  if (DISMISS_WORDS.test(label) || el.closest("[data-slot=dialog-close]")) return "dismiss"
  if (DANGER_WORDS.test(label) || DANGER_CLASSES.test(classes)) return "danger"
  if (tag === "A") return "link"
  if ((el as HTMLButtonElement).type === "submit" || PRIMARY_CLASSES.test(classes)) return "confirm"
  return "tap"
}

export function ClickSoundProvider() {
  useEffect(() => {
    let enabled = isClickSoundEnabled()
    const stopListening = onClickSoundChange(() => { enabled = isClickSoundEnabled() })

    const onClick = (event: MouseEvent) => {
      if (!enabled) return
      const target = (event.target as Element | null)?.closest?.(INTERACTIVE) as HTMLElement | null
      if (!target) return
      if ((target as HTMLButtonElement).disabled || target.getAttribute("aria-disabled") === "true") return
      playClickSound(soundFor(target))
    }

    document.addEventListener("click", onClick, true)
    return () => {
      document.removeEventListener("click", onClick, true)
      stopListening()
    }
  }, [])

  return null
}
