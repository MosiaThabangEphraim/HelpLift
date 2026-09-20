// Remembers whether the person has moved between pages of this site in the
// current tab, so a "Back" button knows whether going back is safe. If they
// opened the page directly (a bookmark, a new tab, a link from elsewhere) there
// is nothing of ours to go back to, and the button should take them somewhere
// sensible instead of leaving the site.
//
// sessionStorage keeps the count across a page reload (browser history also
// survives one) and starts fresh in every new tab.

const KEY = "helplift:route-changes"

export function noteRouteChange() {
  try {
    const current = Number(window.sessionStorage.getItem(KEY) || "0")
    window.sessionStorage.setItem(KEY, String(current + 1))
  } catch {
    // Storage can be blocked; the back button then always uses its fallback.
  }
}

export function hasInAppHistory(): boolean {
  try {
    return Number(window.sessionStorage.getItem(KEY) || "0") > 0
  } catch {
    return false
  }
}
