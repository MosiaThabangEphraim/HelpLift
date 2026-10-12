"use client"

import { useEffect } from "react"

// Dashboard colour schemes (Settings -> User interface -> Colour scheme).
// A personal preference on this device. Each named scheme restyles the whole
// dashboard - accent colours (Tailwind's blue/indigo), the neutral greys
// (slate) used for text, lines and muted surfaces, the page background, and
// the dark-mode surfaces - through html[data-scheme] in globals.css. Success
// green, warning amber and danger red keep their meaning. Light/dark mode
// stays on the theme button. Applied only while a dashboard is open
// (useDashboardColorScheme); "default" is HelpLift's own look.

// preview: colours for the mini dashboard shown on each Settings tile -
// accent gradient, then light mode (page, panel, line) and dark mode (page,
// panel, line).
export const COLOR_SCHEMES = [
  { value: "default", label: "Default", description: "HelpLift's own blue and navy",
    preview: { accent: ["#2563eb", "#4f46e5"], light: ["#FAFAFA", "#ffffff", "#e2e8f0"], dark: ["#0B1220", "#121B2E", "#233350"] } },
  { value: "forest", label: "Forest", description: "Teal and emerald on sage, deep pine at night",
    preview: { accent: ["#0d9488", "#059669"], light: ["#F1F6F2", "#ffffff", "#d2ddd5"], dark: ["#0A1712", "#10221A", "#21402F"] } },
  { value: "sunset", label: "Sunset", description: "Orange and rose on warm cream, espresso at night",
    preview: { accent: ["#ea580c", "#e11d48"], light: ["#FBF6F1", "#ffffff", "#e5dcd3"], dark: ["#17110D", "#211812", "#3D2D22"] } },
  { value: "midnight", label: "Midnight", description: "Violet and fuchsia on lilac, deep indigo at night",
    preview: { accent: ["#7c3aed", "#c026d3"], light: ["#F6F4FB", "#ffffff", "#dcd8ec"], dark: ["#110D1F", "#19142C", "#30274F"] } },
] as const

export type ColorScheme = (typeof COLOR_SCHEMES)[number]["value"]

const STORAGE_KEY = "helplift:color-scheme"
const CHANGE_EVENT = "helplift:color-scheme-change"

export function getColorScheme(): ColorScheme {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return COLOR_SCHEMES.some(scheme => scheme.value === stored) ? (stored as ColorScheme) : "default"
  } catch {
    return "default"
  }
}

export function setColorScheme(scheme: ColorScheme) {
  try {
    window.localStorage.setItem(STORAGE_KEY, scheme)
  } catch {}
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

/** Applies the chosen colour scheme while the calling dashboard is mounted. */
export function useDashboardColorScheme() {
  useEffect(() => {
    const apply = () => {
      const scheme = getColorScheme()
      if (scheme === "default") delete document.documentElement.dataset.scheme
      else document.documentElement.dataset.scheme = scheme
    }
    apply()
    const onStorage = (event: StorageEvent) => { if (event.key === STORAGE_KEY) apply() }
    window.addEventListener(CHANGE_EVENT, apply)
    window.addEventListener("storage", onStorage)
    return () => {
      window.removeEventListener(CHANGE_EVENT, apply)
      window.removeEventListener("storage", onStorage)
      // Leaving the dashboard: the rest of the site keeps the default look.
      delete document.documentElement.dataset.scheme
    }
  }, [])
}
