"use client"

import { useEffect, useRef, useState } from "react"

// Animates a number counting up from 0 the moment it scrolls into view -
// purely cosmetic (the underlying stat is already fetched and correct the
// instant it renders; this just makes it feel alive). After that first
// count-up, any change to `value` (e.g. after a refresh) animates from the
// number on screen to the new one, so the display always matches the data.
// Falls back to showing the final value immediately if IntersectionObserver
// isn't available.
export function CountUp({
  value,
  prefix = "",
  decimals = 0,
  duration = 1200,
  delay = 0,
  easing = "cubic",
  className,
}: {
  value: number
  prefix?: string
  /** Decimal places to animate and display to - e.g. 2 for a Rand amount, matching formatCurrency's own formatting. */
  decimals?: number
  duration?: number
  /** Wait this long (ms) after scrolling into view before counting - for staggering a row of numbers. */
  delay?: number
  /** "expo" races up then settles slowly into the final number. */
  easing?: "cubic" | "expo"
  className?: string
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const [display, setDisplay] = useState(0)
  const displayRef = useRef(0)
  const hasAnimated = useRef(false)
  const frame = useRef(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const factor = Math.pow(10, decimals)
    const show = (next: number) => {
      displayRef.current = next
      setDisplay(next)
    }

    // Animate from whatever is on screen now to `value`.
    const animateTo = (ms: number) => {
      cancelAnimationFrame(frame.current)
      const from = displayRef.current
      const start = performance.now()
      const step = (now: number) => {
        const progress = Math.min(1, (now - start) / ms)
        const eased = easing === "expo"
          ? (progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress)) // ease-out expo
          : 1 - Math.pow(1 - progress, 3) // ease-out cubic
        show(Math.round((from + (value - from) * eased) * factor) / factor)
        if (progress < 1) frame.current = requestAnimationFrame(step)
      }
      frame.current = requestAnimationFrame(step)
    }

    // Already shown once: just move to the new value (shorter, no waiting to scroll into view).
    if (hasAnimated.current) {
      if (displayRef.current !== value) animateTo(Math.min(duration, 600))
      return () => cancelAnimationFrame(frame.current)
    }

    if (typeof IntersectionObserver === "undefined") {
      hasAnimated.current = true
      show(value)
      return
    }
    let delayTimer = 0
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true
          delayTimer = window.setTimeout(() => animateTo(duration), delay)
          observer.disconnect()
        }
      },
      { threshold: 0.3 }
    )
    observer.observe(el)
    return () => {
      observer.disconnect()
      window.clearTimeout(delayTimer)
      cancelAnimationFrame(frame.current)
    }
  }, [value, duration, decimals])

  // en-ZA throughout - matches formatCurrency and every other number already
  // shown on the site (a space as the thousands separator, not a comma).
  return (
    <span ref={ref} className={className}>
      {prefix}
      {display.toLocaleString("en-ZA", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
    </span>
  )
}
