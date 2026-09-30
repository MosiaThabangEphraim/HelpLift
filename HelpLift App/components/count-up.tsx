"use client"

import { useEffect, useRef, useState } from "react"

// Animates a number counting up from 0 the moment it scrolls into view -
// purely cosmetic (the underlying stat is already fetched and correct the
// instant it renders; this just makes it feel alive). Runs once per mount,
// not on every re-render, and falls back to showing the final value
// immediately if IntersectionObserver isn't available.
export function CountUp({
  value,
  prefix = "",
  decimals = 0,
  duration = 1200,
  className,
}: {
  value: number
  prefix?: string
  /** Decimal places to animate and display to - e.g. 2 for a Rand amount, matching formatCurrency's own formatting. */
  decimals?: number
  duration?: number
  className?: string
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const [display, setDisplay] = useState(0)
  const hasAnimated = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === "undefined") {
      setDisplay(value)
      return
    }
    const factor = Math.pow(10, decimals)
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (entry.isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true
          const start = performance.now()
          const animate = (now: number) => {
            const progress = Math.min(1, (now - start) / duration)
            const eased = 1 - Math.pow(1 - progress, 3) // ease-out cubic
            setDisplay(Math.round(value * eased * factor) / factor)
            if (progress < 1) requestAnimationFrame(animate)
          }
          requestAnimationFrame(animate)
          observer.disconnect()
        }
      },
      { threshold: 0.3 }
    )
    observer.observe(el)
    return () => observer.disconnect()
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
