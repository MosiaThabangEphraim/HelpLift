"use client"

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react"

// Fades and lifts its content into place the first time it scrolls into view
// (homepage sections, cards). `delay` (ms) staggers items in a row. With
// Reduce motion on (Settings, or the device's own preference) the content
// simply appears - globals.css turns the transition off.
export function Reveal({
  children,
  delay = 0,
  className = "",
  style,
  id,
}: {
  children: ReactNode
  delay?: number
  className?: string
  style?: CSSProperties
  id?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const element = ref.current
    if (!element) return
    if (typeof IntersectionObserver === "undefined") {
      setShown(true)
      return
    }
    const observer = new IntersectionObserver(
      entries => {
        if (entries.some(entry => entry.isIntersecting)) {
          setShown(true)
          observer.disconnect()
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      id={id}
      className={`reveal ${shown ? "reveal-shown" : ""} ${className}`}
      style={{ transitionDelay: shown ? `${delay}ms` : "0ms", ...style }}
    >
      {children}
    </div>
  )
}
