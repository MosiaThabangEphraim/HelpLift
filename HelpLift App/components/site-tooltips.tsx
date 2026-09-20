"use client"

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import { resolveTooltip, type TooltipArea } from "@/lib/tooltips"

// Site-wide tooltips. One listener watches whichever button, link, tab or badge
// you hover (mouse) or focus (keyboard) and shows the explanation for it from
// lib/tooltips.ts. Elements can also set data-tip="..." themselves, and
// data-no-tip opts an element out. Elements that already have a native title
// attribute are left alone.

const INTERACTIVE = "button, a, [role='button'], [role='tab'], summary, label"
const TOOLTIP_ID = "site-tooltip"
const SHOW_DELAY_MS = 350
const MAX_DEPTH = 5

function areaFor(pathname: string): TooltipArea {
  if (pathname.startsWith("/admin-dashboard")) return "admin"
  if (pathname.startsWith("/organisation-dashboard")) return "org"
  if (pathname.startsWith("/givers-dashboard")) return "giver"
  return "site"
}

function findTip(start: EventTarget | null, area: TooltipArea): { el: Element; text: string } | null {
  let node = start instanceof Element ? start : null
  for (let depth = 0; node && depth < MAX_DEPTH && node !== document.body; depth += 1, node = node.parentElement) {
    if (node.hasAttribute("data-no-tip")) return null
    const explicit = node.getAttribute("data-tip")
    if (explicit) return { el: node, text: explicit }
    if (node.hasAttribute("title")) return null

    const interactive = node.matches(INTERACTIVE)
    const aria = node.getAttribute("aria-label")
    // Plain containers with lots of children are never labels; skip the cost.
    if (interactive || node.childElementCount <= 4) {
      const text = (node.textContent || "").trim()
      const label = aria && !text ? aria : text || aria || ""
      const found = label ? resolveTooltip(label, area, interactive) : null
      if (found) return { el: node, text: found }
      if (interactive && aria && !text) return { el: node, text: aria }
    }
    // The first interactive element is the target; never borrow a parent's tip.
    if (interactive) return null
  }
  return null
}

export function SiteTooltips() {
  const pathname = usePathname()
  const areaRef = useRef<TooltipArea>("site")
  areaRef.current = areaFor(pathname)

  const [tip, setTip] = useState<{ text: string; rect: DOMRect } | null>(null)
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null)
  const bubbleRef = useRef<HTMLDivElement>(null)
  const currentRef = useRef<Element | null>(null)
  const timerRef = useRef<number | null>(null)

  const hide = useCallback(() => {
    if (timerRef.current) window.clearTimeout(timerRef.current)
    timerRef.current = null
    currentRef.current?.removeAttribute("aria-describedby")
    currentRef.current = null
    setTip(null)
    setPosition(null)
  }, [])

  const schedule = useCallback((el: Element, text: string, immediate: boolean) => {
    if (currentRef.current === el) return
    hide()
    const reveal = () => {
      if (!el.isConnected) return
      currentRef.current = el
      el.setAttribute("aria-describedby", TOOLTIP_ID)
      setTip({ text, rect: el.getBoundingClientRect() })
    }
    if (immediate) reveal()
    else timerRef.current = window.setTimeout(reveal, SHOW_DELAY_MS)
  }, [hide])

  useEffect(() => {
    const onPointerOver = (event: PointerEvent) => {
      if (event.pointerType === "touch") return
      const found = findTip(event.target, areaRef.current)
      if (!found) return hide()
      schedule(found.el, found.text, false)
    }
    const onFocusIn = (event: FocusEvent) => {
      const target = event.target
      // Only keyboard focus; mouse clicks shouldn't leave a tooltip behind.
      if (!(target instanceof HTMLElement) || !target.matches(":focus-visible")) return
      const found = findTip(target, areaRef.current)
      if (found) schedule(found.el, found.text, true)
    }
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") hide() }

    document.addEventListener("pointerover", onPointerOver)
    document.addEventListener("focusin", onFocusIn)
    document.addEventListener("focusout", hide)
    document.addEventListener("pointerdown", hide)
    document.addEventListener("keydown", onKeyDown)
    window.addEventListener("scroll", hide, true)
    window.addEventListener("blur", hide)
    return () => {
      document.removeEventListener("pointerover", onPointerOver)
      document.removeEventListener("focusin", onFocusIn)
      document.removeEventListener("focusout", hide)
      document.removeEventListener("pointerdown", hide)
      document.removeEventListener("keydown", onKeyDown)
      window.removeEventListener("scroll", hide, true)
      window.removeEventListener("blur", hide)
    }
  }, [hide, schedule])

  // A route change leaves the old element behind; drop any open tooltip.
  useEffect(() => { hide() }, [pathname, hide])

  // Place the bubble above the element (below if there's no room), kept on screen.
  useLayoutEffect(() => {
    if (!tip || !bubbleRef.current) return
    const bubble = bubbleRef.current.getBoundingClientRect()
    const margin = 8
    let top = tip.rect.top - bubble.height - margin
    if (top < margin) top = tip.rect.bottom + margin
    let left = tip.rect.left + tip.rect.width / 2 - bubble.width / 2
    left = Math.max(margin, Math.min(left, window.innerWidth - bubble.width - margin))
    setPosition({ left, top })
  }, [tip])

  if (!tip) return null
  return (
    <div
      ref={bubbleRef}
      id={TOOLTIP_ID}
      role="tooltip"
      style={{ position: "fixed", left: position?.left ?? 0, top: position?.top ?? 0, visibility: position ? "visible" : "hidden" }}
      className="pointer-events-none z-[9999] max-w-[260px] rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-medium leading-snug text-white shadow-lg dark:bg-slate-100 dark:text-slate-900"
    >
      {tip.text}
    </div>
  )
}
