// Whether the floating HelpLift Assistant is shown to a signed-in user - a
// personal preference kept in localStorage on this device, like notification
// sounds and font size. Switched off from the chat window itself and back on
// from Settings. Visitors who aren't signed in always see the assistant, so the
// preference is ignored for them.

const STORAGE_KEY = "helplift:assistant"
const CHANGE_EVENT = "helplift:assistant-change"

export function isAssistantEnabled(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== "off"
  } catch {
    return true
  }
}

export function setAssistantEnabled(enabled: boolean) {
  try {
    window.localStorage.setItem(STORAGE_KEY, enabled ? "on" : "off")
  } catch {}
  // Same-tab listeners; other tabs hear it through the "storage" event.
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

// Calls `listener` whenever the preference changes, in this tab or another one.
export function onAssistantPreferenceChange(listener: () => void) {
  const onStorage = (event: StorageEvent) => { if (event.key === STORAGE_KEY) listener() }
  window.addEventListener(CHANGE_EVENT, listener)
  window.addEventListener("storage", onStorage)
  return () => {
    window.removeEventListener(CHANGE_EVENT, listener)
    window.removeEventListener("storage", onStorage)
  }
}
