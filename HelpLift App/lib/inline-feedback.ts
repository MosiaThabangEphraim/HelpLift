"use client"

// A tiny pub-sub for the site's inline confirmation bubbles - "Need closed.",
// "Email updated.", "You have already expressed interest in this need." -
// shown right next to whichever button the person just clicked, instead of
// in a banner up at the top of the page, far from where they were looking.
//
// Any file can call showFeedback(...) directly, the same way pages used to
// call a local setMessage/setError. components/inline-feedback.tsx is the
// one global listener that actually renders the bubble.
//
// Anchoring: a document-level pointerdown listener snapshots the bounding
// rect of whatever was just clicked. showFeedback() re-reads that snapshot
// (not a live element reference - the button it was called from may already
// be gone by the time an async action finishes, e.g. a "Close" row that
// disappears once the list reloads) so positioning never depends on a DOM
// node that might no longer be attached. If nothing was clicked recently
// (a background/async message with no obvious anchor), there's no rect to
// use and the bubble falls back to a fixed spot instead.

export type FeedbackVariant = "success" | "error"
export type FeedbackEvent = { text: string; variant: FeedbackVariant; rect: DOMRect | null }

type Listener = (event: FeedbackEvent) => void
const listeners = new Set<Listener>()

let lastClickRect: DOMRect | null = null
let lastClickAt = 0
const MAX_ANCHOR_AGE_MS = 4000
const INTERACTIVE = "button, a, [role='button'], [role='tab'], summary, label"

function remember(el: Element) {
  lastClickRect = el.getBoundingClientRect()
  lastClickAt = Date.now()
}

if (typeof document !== "undefined") {
  // Mouse/touch: closest interactive ancestor of whatever was actually pressed.
  document.addEventListener(
    "pointerdown",
    (event) => {
      if (!(event.target instanceof Element)) return
      const el = event.target.closest(INTERACTIVE)
      if (el) remember(el)
    },
    true
  )
  // Keyboard activation (Enter/Space on a button or role="button" element,
  // the same pattern lib/keyboard.ts's activateOnKey handles) - a
  // pointerdown alone misses this, so without it a keyboard-only
  // confirmation always fell back to the no-anchor default position.
  document.addEventListener(
    "keydown",
    (event) => {
      if (event.key !== "Enter" && event.key !== " ") return
      if (!(event.target instanceof Element)) return
      const el = event.target.closest(INTERACTIVE)
      if (el) remember(el)
    },
    true
  )
  // A <form onSubmit> triggered by pressing Enter in one of its fields (no
  // button ever gets a pointerdown or keydown) - anchor to its submit
  // button if there's an obvious one, else the form itself.
  document.addEventListener(
    "submit",
    (event) => {
      if (!(event.target instanceof HTMLFormElement)) return
      const submitBtn = event.target.querySelector("button[type='submit'], button:not([type])")
      remember(submitBtn instanceof Element ? submitBtn : event.target)
    },
    true
  )
}

export function showFeedback(text: string, variant: FeedbackVariant = "success") {
  if (!text) return
  const rect = Date.now() - lastClickAt <= MAX_ANCHOR_AGE_MS ? lastClickRect : null
  const event: FeedbackEvent = { text, variant, rect }
  listeners.forEach((fn) => fn(event))
}

export function subscribeFeedback(fn: Listener) {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}
