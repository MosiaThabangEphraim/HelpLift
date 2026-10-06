"use client"

import { useEffect, useRef, useState } from "react"
import { isClockShown, onClockPreferenceChange } from "@/lib/clock-preference"

// A small live analog clock with a digital readout beside it - the visitor's
// own local time, nothing fetched.
// The hands are moved by writing their rotation straight onto the SVG every
// animation frame (no React re-render per frame), so the second hand sweeps
// smoothly at almost no cost. With Reduce motion on (Settings, or the
// device's own preference) it ticks once a second instead of sweeping. The
// digital time (with seconds) and the date sit beside the face.

const TICKS = Array.from({ length: 60 }, (_, i) => i)

function prefersReducedMotion() {
  if (typeof window === "undefined") return false
  return document.documentElement.classList.contains("reduce-motion") || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
}

// Shown unless turned off in Settings (lib/clock-preference.ts). When hidden,
// the clock isn't mounted at all, so its animation stops completely.
export function AnalogClock({ size = 52, className = "" }: { size?: number; className?: string }) {
  const [shown, setShown] = useState<boolean | null>(null)

  useEffect(() => {
    const sync = () => setShown(isClockShown())
    sync()
    return onClockPreferenceChange(sync)
  }, [])

  if (shown === false) return null
  if (shown === null) return <div style={{ height: size }} aria-hidden="true" />
  return <ClockFace size={size} className={className} />
}

function ClockFace({ size, className }: { size: number; className: string }) {
  const hourRef = useRef<SVGLineElement>(null)
  const minuteRef = useRef<SVGLineElement>(null)
  const secondRef = useRef<SVGGElement>(null)
  const digitalRef = useRef<HTMLSpanElement>(null)
  // Only for the date and the screen-reader label - updated once a minute.
  const [now, setNow] = useState<Date | null>(null)

  useEffect(() => {
    let frame = 0
    let interval = 0
    let lastMinute = -1
    let lastSecond = -1

    const draw = () => {
      const date = new Date()
      const ms = date.getMilliseconds()
      const smooth = !prefersReducedMotion()
      const seconds = date.getSeconds() + (smooth ? ms / 1000 : 0)
      const minutes = date.getMinutes() + seconds / 60
      const hours = (date.getHours() % 12) + minutes / 60
      hourRef.current?.setAttribute("transform", `rotate(${hours * 30} 50 50)`)
      minuteRef.current?.setAttribute("transform", `rotate(${minutes * 6} 50 50)`)
      secondRef.current?.setAttribute("transform", `rotate(${seconds * 6} 50 50)`)
      // The digital readout changes once a second - written directly, no re-render.
      if (date.getSeconds() !== lastSecond && digitalRef.current) {
        lastSecond = date.getSeconds()
        digitalRef.current.textContent = date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" })
      }
      if (date.getMinutes() !== lastMinute) {
        lastMinute = date.getMinutes()
        setNow(date)
      }
    }

    const loop = () => {
      draw()
      frame = requestAnimationFrame(loop)
    }
    const start = () => {
      cancelAnimationFrame(frame)
      window.clearInterval(interval)
      draw()
      // Sweep with animation frames, or tick once a second when motion is reduced.
      if (prefersReducedMotion()) interval = window.setInterval(draw, 1000)
      else frame = requestAnimationFrame(loop)
    }

    start()
    // Re-sync when the tab comes back (browsers pause animation frames in background tabs).
    const onVisible = () => { if (document.visibilityState === "visible") start() }
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      cancelAnimationFrame(frame)
      window.clearInterval(interval)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [])

  // Server-rendered markup can't know the visitor's local time - render
  // nothing until the first client-side tick (avoids a hydration mismatch).
  if (!now) return <div style={{ height: size }} aria-hidden="true" />

  const timeLabel = now.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <p className="text-right leading-tight">
        <span ref={digitalRef} aria-hidden="true" className="block text-lg font-extrabold tabular-nums tracking-tight text-slate-900 dark:text-slate-100">
          {now.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
        </span>
        <span className="block text-xs font-semibold text-slate-500 dark:text-slate-400">
          {now.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </span>
      </p>
      <svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        role="img"
        aria-label={`Current time ${timeLabel}`}
        className="shrink-0 text-slate-700 dark:text-slate-200"
      >
        <circle cx="50" cy="50" r="47" className="fill-white dark:fill-[#121B2E] stroke-slate-200 dark:stroke-[#233350]" strokeWidth="2" />
        {TICKS.map(i => {
          const hourMark = i % 5 === 0
          return (
            <line
              key={i}
              x1="50"
              y1={hourMark ? 7 : 8}
              x2="50"
              y2={hourMark ? 15 : 11}
              stroke="currentColor"
              strokeWidth={hourMark ? 2.5 : 1}
              strokeLinecap="round"
              opacity={hourMark ? 0.9 : 0.35}
              transform={`rotate(${i * 6} 50 50)`}
            />
          )
        })}
        <line ref={hourRef} x1="50" y1="54" x2="50" y2="28" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
        <line ref={minuteRef} x1="50" y1="56" x2="50" y2="17" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
        <g ref={secondRef}>
          <line x1="50" y1="60" x2="50" y2="13" className="stroke-blue-600 dark:stroke-blue-400" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="50" cy="50" r="3" className="fill-blue-600 dark:fill-blue-400" />
        </g>
      </svg>
    </div>
  )
}
