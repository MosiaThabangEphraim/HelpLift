// A personal "Reduce motion" preference under Settings - kept in localStorage
// on this device, like font size (lib/font-size.ts). When on, the <html>
// element gets a "reduce-motion" class and globals.css switches off
// animations and transitions site-wide (tab transitions, slides, fades,
// pulses); loading spinners keep turning so it's still clear something is
// loading. People whose device already asks for reduced motion get the same
// via Tailwind's motion-reduce variants and the CSS media query.

const STORAGE_KEY = "helplift:reduce-motion"

export function getReduceMotion(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "on"
  } catch {
    return false
  }
}

export function applyReduceMotion(on: boolean) {
  if (typeof document === "undefined") return
  document.documentElement.classList.toggle("reduce-motion", on)
}

export function setReduceMotion(on: boolean) {
  try {
    window.localStorage.setItem(STORAGE_KEY, on ? "on" : "off")
  } catch {
    // Storage can be blocked (private windows); the choice just won't persist.
  }
  applyReduceMotion(on)
}
