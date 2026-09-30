// A personal "larger text" preference under Settings - kept in localStorage
// per-browser (same convention as lib/notification-sound.ts), not synced to
// the account, since it's a display preference rather than data.
//
// Applied by scaling the root <html> font-size (see the .font-size-large/
// .font-size-larger rules in app/globals.css). Tailwind's text-sm/base/lg/
// etc. utilities are all defined in rem units, relative to that root size,
// so this one change proportionally scales every bit of text across the
// whole app - no need to touch any of its hundreds of individual
// hardcoded text-size classes.
export type FontSizeLevel = "normal" | "large" | "larger"

const STORAGE_KEY = "helplift:font-size"
const LEVELS: FontSizeLevel[] = ["normal", "large", "larger"]

export function getFontSizeLevel(): FontSizeLevel {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return (LEVELS as string[]).includes(stored || "") ? (stored as FontSizeLevel) : "normal"
  } catch {
    return "normal"
  }
}

// Toggles the class on <html> that globals.css scales the root font-size
// from. Called once on every page load (see components/font-size-provider.tsx)
// and again immediately whenever the Settings control changes it.
export function applyFontSizeLevel(level: FontSizeLevel) {
  if (typeof document === "undefined") return
  const root = document.documentElement
  for (const l of LEVELS) root.classList.remove(`font-size-${l}`)
  if (level !== "normal") root.classList.add(`font-size-${level}`)
}

export function setFontSizeLevel(level: FontSizeLevel) {
  try {
    window.localStorage.setItem(STORAGE_KEY, level)
  } catch {
    // Storage can be blocked (private windows); the choice just won't persist.
  }
  applyFontSizeLevel(level)
}
