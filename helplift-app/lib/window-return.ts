// "Back to ..." for windows opened from another window - e.g. a notification
// opened from the Notifications list, or Edit profile opened from Settings.
//
// The window doing the opening calls setReturnTo("Notifications", reopen)
// just before it opens the next one. The next window to appear
// (components/ui/dialog.tsx) picks it up and shows "← Back to Notifications",
// which closes it and calls `reopen`. It only applies to a window that opens
// within a couple of seconds, so a stale entry never attaches itself to some
// unrelated window later.

type ReturnTo = { label: string; reopen: () => void; at: number }

const FRESH_FOR_MS = 2000
let pending: ReturnTo | null = null

export function setReturnTo(label: string, reopen: () => void) {
  pending = { label, reopen, at: Date.now() }
}

/** The pending "back" target, if one was set moments ago. Doesn't clear it. */
export function getReturnTo(): ReturnTo | null {
  if (!pending) return null
  if (Date.now() - pending.at > FRESH_FOR_MS) {
    pending = null
    return null
  }
  return pending
}

export function clearReturnTo() {
  pending = null
}
