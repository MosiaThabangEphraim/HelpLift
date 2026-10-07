"use client"

import { useEffect, useState } from "react"
import { Moon, Sun, Sunrise, Sunset } from "lucide-react"

// "Good morning / afternoon / evening" (or "Hello, night owl" after
// midnight) beside the dashboard clock, using the
// visitor's own local time. Rechecked every minute, so it changes on its own
// as the day goes on. The line under it changes with the time of day too, and
// picks a different one each day.

type Period = {
  greeting: string
  icon: typeof Sun
  iconClass: string
  lines: string[]
}

const PERIODS: { from: number; period: Period }[] = [
  {
    from: 5,
    period: {
      greeting: "Good morning",
      icon: Sunrise,
      iconClass: "text-amber-500 bg-amber-50 dark:bg-amber-950/40",
      lines: [
        "A fresh morning to make a difference.",
        "Start your day by changing someone else's.",
        "Rise and shine - there's good to be done today.",
      ],
    },
  },
  {
    from: 12,
    period: {
      greeting: "Good afternoon",
      icon: Sun,
      iconClass: "text-yellow-500 bg-yellow-50 dark:bg-yellow-950/40",
      lines: [
        "Hope your afternoon is going well.",
        "A midday moment to check on new needs.",
        "Halfway through the day - still time to help someone.",
      ],
    },
  },
  {
    from: 18,
    period: {
      greeting: "Good evening",
      icon: Sunset,
      iconClass: "text-orange-500 bg-orange-50 dark:bg-orange-950/40",
      lines: [
        "Hope you had a good day.",
        "Unwind this evening and catch up on what's new.",
        "End your day by making someone else's better.",
      ],
    },
  },
  {
    // Still "Good evening" late at night - "Good night" is a goodbye, not a greeting.
    from: 21,
    period: {
      greeting: "Good evening",
      icon: Moon,
      iconClass: "text-indigo-500 bg-indigo-50 dark:bg-indigo-950/40",
      lines: [
        "Working late tonight? Don't forget to rest.",
        "Thank you for giving your time tonight.",
        "Winding down for the night? Here's what's new.",
      ],
    },
  },
]

// After midnight and before 05:00.
const LATE_NIGHT: Period = {
  greeting: "Hello, night owl",
  icon: Moon,
  iconClass: "text-indigo-500 bg-indigo-50 dark:bg-indigo-950/40",
  lines: [
    "Up past midnight? Don't forget to get some sleep.",
    "Thanks for giving your time, even in the small hours.",
    "It's late - rest well, there's always tomorrow to do more good.",
  ],
}

function periodFor(hour: number): Period {
  if (hour < 5) return LATE_NIGHT
  return [...PERIODS].reverse().find(entry => hour >= entry.from)!.period
}

export function TimeGreeting({ name, firstNameOnly = false, className = "" }: { name?: string | null; firstNameOnly?: boolean; className?: string }) {
  const [now, setNow] = useState<Date | null>(null)

  useEffect(() => {
    setNow(new Date())
    const interval = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(interval)
  }, [])

  // The server can't know the visitor's local time - render after mounting.
  if (!now) return <div className={className} aria-hidden="true" />

  const period = periodFor(now.getHours())
  const Icon = period.icon
  const dayNumber = Math.floor(now.getTime() / 86_400_000)
  const line = period.lines[dayNumber % period.lines.length]
  const shownName = name?.trim() ? (firstNameOnly ? name.trim().split(/\s+/)[0] : name.trim()) : ""

  return (
    <div className={`flex min-w-0 items-center gap-3 animate-in fade-in slide-in-from-left-2 duration-500 ${className}`}>
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${period.iconClass}`}>
        <Icon className="h-6 w-6 animate-[greeting-float_4s_ease-in-out_infinite]" aria-hidden="true" />
      </span>
      <p className="min-w-0 leading-tight">
        <span className="block truncate text-lg font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
          {period.greeting}{shownName ? `, ${shownName}` : ""}
        </span>
        <span className="block truncate text-xs font-semibold text-slate-500 dark:text-slate-400">{line}</span>
      </p>
    </div>
  )
}
