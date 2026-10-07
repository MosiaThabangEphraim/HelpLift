"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Building2, ExternalLink, Trophy } from "lucide-react"
import { UserAvatar } from "@/components/user-avatar"

type SpotlightData = {
  period: string | null
  periodLabel: string | null
  giver: { name: string; avatarUrl: string | null; needsSupported: number } | null
  organization: { id: string; name: string; logoUrl: string | null; needsFulfilled: number } | null
}

// "Giver of the Month" / "Organization of the Month" - shown on the
// homepage next to Impact Stories. Always the most recently completed
// month (see lib/spotlights.ts) - never a live, currently-shifting
// leaderboard. Renders nothing at all if the platform has no qualifying
// activity yet for that month, rather than showing an empty section.
export function MonthlySpotlight() {
  const [data, setData] = useState<SpotlightData | null>(null)

  useEffect(() => {
    fetch("/api/public/spotlights")
      .then((res) => res.json())
      .then((d) => setData(d))
      .catch(() => {})
  }, [])

  if (!data || (!data.giver && !data.organization)) return null

  return (
    <section className="py-10">
      <div className="max-w-6xl mx-auto px-4">
        {/* Same header style as the other homepage sections. */}
        <div className="mb-6">
          <p className="flex items-center gap-2 text-sm font-bold text-blue-600 dark:text-blue-400">
            <span className="reveal-pop flex h-6 w-6 items-center justify-center rounded-md bg-blue-600 text-white">
              <Trophy className="h-3.5 w-3.5" />
            </span>
            Spotlight
          </p>
          <h2 className="mt-3 text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">This month&apos;s spotlight.</h2>
          {data.periodLabel && <p className="mt-2 text-slate-500 dark:text-slate-400">{data.periodLabel}</p>}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {data.giver && (
            <div className="rounded-2xl bg-white/70 dark:bg-slate-900/40 p-6 flex items-center gap-5 transition-all duration-300 hover:-translate-y-1 hover:bg-white dark:hover:bg-slate-900/70">
              <UserAvatar src={data.giver.avatarUrl} name={data.giver.name} className="size-16 text-2xl shadow-lg shadow-amber-500/30 ring-2 ring-white dark:ring-[#0B1220]" />
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">Giver of the Month</p>
                <h3 className="text-xl font-extrabold text-slate-900 dark:text-slate-100 truncate">{data.giver.name}</h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 mt-0.5">
                  Supported {data.giver.needsSupported} need{data.giver.needsSupported === 1 ? "" : "s"} this month
                </p>
              </div>
            </div>
          )}

          {data.organization && (
            <div className="rounded-2xl bg-white/70 dark:bg-slate-900/40 p-6 flex items-center gap-5 transition-all duration-300 hover:-translate-y-1 hover:bg-white dark:hover:bg-slate-900/70">
              <div className="shrink-0 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 p-4 text-white shadow-lg shadow-blue-500/30 overflow-hidden">
                {data.organization.logoUrl ? (
                  <img src={data.organization.logoUrl} alt={data.organization.name} className="w-7 h-7 object-cover rounded" />
                ) : (
                  <Building2 className="w-7 h-7" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">Organization of the Month</p>
                <Link href={`/organizations/${data.organization.id}`} className="flex items-center gap-1.5 group">
                  <h3 className="text-xl font-extrabold text-slate-900 dark:text-slate-100 truncate group-hover:underline">{data.organization.name}</h3>
                  <ExternalLink className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                </Link>
                <p className="text-sm text-slate-600 dark:text-slate-300 mt-0.5">
                  Fulfilled {data.organization.needsFulfilled} need{data.organization.needsFulfilled === 1 ? "" : "s"} this month
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
