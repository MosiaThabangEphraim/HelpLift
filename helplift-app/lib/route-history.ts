// Remembers the pages the person has moved through in this tab, so a "Back"
// button knows whether going back is safe. If they opened the page directly
// (a bookmark, a new tab, a link from elsewhere) there is nothing of ours to go
// back to, and the button should take them somewhere sensible instead of
// leaving the site.
//
// It's a list of paths, not just a count, so Back can also tell where it would
// land: going back to a page *inside* the current one (an organization's page
// when you're on the organizations list) would only bounce you back and forth,
// so the button uses its fallback instead.
//
// sessionStorage keeps the list across a page reload (browser history also
// survives one) and starts fresh in every new tab.

const KEY = "helplift:route-stack"
const MAX_ENTRIES = 50

function readStack(): string[] {
  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(KEY) || "[]")
    return Array.isArray(parsed) ? parsed.filter(entry => typeof entry === "string") : []
  } catch {
    return []
  }
}

/** Records the page now showing. Returning to the page before it counts as going back. */
export function noteRoute(pathname: string) {
  const stack = readStack()
  if (stack[stack.length - 1] === pathname) return // a reload, or the same page
  if (stack[stack.length - 2] === pathname) stack.pop() // went back
  else stack.push(pathname)
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(stack.slice(-MAX_ENTRIES)))
  } catch {
    // Storage can be blocked; the back button then always uses its fallback.
  }
}

/**
 * True when going back lands on another page of this site that isn't inside
 * the current one (so it can't bounce between a list and one of its items).
 */
export function canGoBackFrom(pathname: string): boolean {
  const stack = readStack()
  const previous = stack[stack.length - 2]
  if (!previous || stack[stack.length - 1] !== pathname) return false
  return !previous.startsWith(`${pathname.replace(/\/$/, "")}/`)
}
