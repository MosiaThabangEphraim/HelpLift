import type { KeyboardEvent } from "react"

// Activates a plain element standing in for a real <button> (role="button"
// tabIndex={0}, used where a disabled <fieldset> would otherwise switch off
// a real button too - e.g. a role without access on a dashboard, or a
// whole row that's clickable but also holds its own inner buttons).
// Wire this to onKeyDown alongside role="button" and tabIndex={0} so Enter
// and Space work the same way native buttons do - Tab reaching it isn't
// enough by itself; without this, screen readers announce "button" but
// pressing Enter/Space does nothing.
//
// Ignores keys that bubbled up from a nested interactive child (the row's
// own buttons/links) so pressing Enter on one of those doesn't ALSO
// re-trigger the outer row's click.
export function activateOnKey(event: KeyboardEvent<HTMLElement>) {
  if (event.target !== event.currentTarget) return
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault()
    event.currentTarget.click()
  }
}
