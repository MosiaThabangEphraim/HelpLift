"use client"

import { useEffect, useState } from "react"

// Plain "what's the date and time right now" readout for the top of every
// dashboard - purely informational, the visitor's own local clock, nothing
// fetched or synced. Ticks once a minute, since it only ever shows minutes.
export function LiveClock({ className = "" }: { className?: string }) {
  const [now, setNow] = useState<Date | null>(null)

  useEffect(() => {
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(id)
  }, [])

  // Server-rendered markup can't know the visitor's exact local time, so
  // this renders nothing until the first client-side tick - avoids a
  // hydration mismatch rather than briefly showing the wrong minute.
  if (!now) return null

  return (
    <p className={`text-xs font-semibold text-slate-500 dark:text-slate-400 ${className}`}>
      {now.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
      {" · "}
      {now.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
    </p>
  )
}
