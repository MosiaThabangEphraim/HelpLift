// Whether the dashboards show the clock and date (components/analog-clock.tsx).
// On by default; switched off in Settings and kept in localStorage on this
// device, like font size. Changes apply straight away in every open tab.

const STORAGE_KEY = "helplift:show-clock"
const CHANGE_EVENT = "helplift:show-clock-change"

export function isClockShown(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== "off"
  } catch {
    return true
  }
}

export function setClockShown(on: boolean) {
  try {
    window.localStorage.setItem(STORAGE_KEY, on ? "on" : "off")
  } catch {
    // Storage can be blocked (private windows); the choice just won't persist.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

/** Calls `listener` when the setting changes here or in another tab. */
export function onClockPreferenceChange(listener: () => void) {
  const onStorage = (event: StorageEvent) => { if (event.key === STORAGE_KEY) listener() }
  window.addEventListener(CHANGE_EVENT, listener)
  window.addEventListener("storage", onStorage)
  return () => {
    window.removeEventListener(CHANGE_EVENT, listener)
    window.removeEventListener("storage", onStorage)
  }
}
