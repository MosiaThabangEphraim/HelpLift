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
        <div className="flex items-center gap-2 mb-8">
          <Trophy className="w-6 h-6 text-amber-500" />
          <div>
            <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">This Month's Spotlight</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">{data.periodLabel}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {data.giver && (
            <div className="rounded border border-amber-200 dark:border-amber-900 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/20 p-6 flex items-center gap-5 shadow-sm">
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
            <div className="rounded border border-blue-200 dark:border-blue-900 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/20 p-6 flex items-center gap-5 shadow-sm">
              <div className="shrink-0 rounded bg-gradient-to-br from-blue-500 to-indigo-600 p-4 text-white shadow-lg shadow-blue-500/30 overflow-hidden">
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
