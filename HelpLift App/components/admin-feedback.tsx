"use client"

import { useEffect, useMemo, useState } from "react"
import { Loader2, Star } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartCard, RankedBars, StatTile, VizRoot } from "@/components/analytics/chart-parts"

type Feedback = {
  id: string
  sender_role: string
  sender_name: string
  sender_email: string | null
  rating: number
  message: string | null
  created_at: string
}

function Stars({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map(n => (
        <Star key={n} className={`h-4 w-4 ${n <= value ? "fill-amber-400 text-amber-400" : "text-slate-300 dark:text-slate-600"}`} />
      ))}
    </span>
  )
}

const number = (value: number) => String(Math.round(value))

// Admin's Feedback tab: the ratings and improvement ideas givers and
// organizations have sent, with a summary and filters.
export function AdminFeedback() {
  const [items, setItems] = useState<Feedback[] | null>(null)
  const [error, setError] = useState("")
  const [ratingFilter, setRatingFilter] = useState<"all" | "1" | "2" | "3" | "4" | "5">("all")
  const [roleFilter, setRoleFilter] = useState<"all" | "giver" | "organization">("all")
  const [withCommentOnly, setWithCommentOnly] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/admin/feedback")
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.message || "Could not load feedback.")
        setItems(data.feedback || [])
      } catch (err: any) {
        setError(err.message || "Could not load feedback.")
        setItems([])
      }
    }
    load()
  }, [])

  const summary = useMemo(() => {
    const all = items || []
    const average = all.length ? all.reduce((total, f) => total + f.rating, 0) / all.length : 0
    const monthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000
    return {
      count: all.length,
      average,
      recent: all.filter(f => new Date(f.created_at).getTime() >= monthAgo).length,
      withComments: all.filter(f => f.message).length,
      distribution: [5, 4, 3, 2, 1].map(stars => ({ name: `${stars} star${stars === 1 ? "" : "s"}`, value: all.filter(f => f.rating === stars).length })),
    }
  }, [items])

  const visible = useMemo(
    () => (items || []).filter(f =>
      (ratingFilter === "all" || f.rating === Number(ratingFilter)) &&
      (roleFilter === "all" || f.sender_role === roleFilter) &&
      (!withCommentOnly || !!f.message)
    ),
    [items, ratingFilter, roleFilter, withCommentOnly]
  )

  if (items === null) {
    return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>
  }

  const selectClass = "rounded-xl border border-slate-200 dark:border-[#233350] bg-white dark:bg-[#0B1220] px-3 py-2 text-sm font-semibold"

  return (
    <VizRoot>
      {error && <p className="rounded-xl bg-red-50 dark:bg-red-950/40 p-3 text-sm font-semibold text-red-700 dark:text-red-300">{error}</p>}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Average rating" value={summary.count ? summary.average.toFixed(1) : "-"} note={summary.count ? "out of 5" : "No ratings yet"} />
        <StatTile label="Total feedback" value={String(summary.count)} />
        <StatTile label="Last 30 days" value={String(summary.recent)} />
        <StatTile label="With a comment" value={String(summary.withComments)} />
      </div>

      <ChartCard
        title="Ratings"
        description="How many people gave each rating"
        isEmpty={summary.count === 0}
        emptyText="No feedback yet."
        rows={summary.distribution.map(p => ({ label: p.name, value: String(p.value) }))}
        valueHeading="People"
      >
        <RankedBars data={summary.distribution} seriesLabel="People" format={number} />
      </ChartCard>

      <Card>
        <CardHeader>
          <CardTitle>All feedback</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <select value={ratingFilter} onChange={e => setRatingFilter(e.target.value as any)} className={selectClass} aria-label="Filter by rating">
              <option value="all">All ratings</option>
              {[5, 4, 3, 2, 1].map(n => <option key={n} value={n}>{n} star{n === 1 ? "" : "s"}</option>)}
            </select>
            <select value={roleFilter} onChange={e => setRoleFilter(e.target.value as any)} className={selectClass} aria-label="Filter by who sent it">
              <option value="all">Givers and organizations</option>
              <option value="giver">Givers only</option>
              <option value="organization">Organizations only</option>
            </select>
            <label className="inline-flex items-center gap-2 text-sm font-semibold">
              <input type="checkbox" checked={withCommentOnly} onChange={e => setWithCommentOnly(e.target.checked)} className="h-4 w-4 accent-blue-600" />
              With a comment
            </label>
            <span className="ml-auto text-xs text-slate-500">{visible.length} of {summary.count}</span>
          </div>

          {visible.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-300 dark:border-[#233350] p-6 text-center text-sm text-slate-500">No feedback matches.</p>
          ) : (
            <div className="space-y-3">
              {visible.map(item => (
                <article key={item.id} className="rounded-2xl border border-slate-200 dark:border-[#233350] p-4 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <Stars value={item.rating} />
                      <span className="text-sm font-bold">{item.sender_name}</span>
                      <span className="rounded-full bg-slate-100 dark:bg-[#1A2740] px-2 py-0.5 text-[11px] font-bold capitalize text-slate-600 dark:text-slate-300">{item.sender_role}</span>
                    </div>
                    <span className="text-[11px] text-slate-400">{new Date(item.created_at).toLocaleString()}</span>
                  </div>
                  {item.message ? (
                    <p className="whitespace-pre-line text-sm text-slate-700 dark:text-slate-300">{item.message}</p>
                  ) : (
                    <p className="text-sm italic text-slate-400">No comment.</p>
                  )}
                  {item.sender_email && <p className="text-xs text-slate-400">{item.sender_email}</p>}
                </article>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </VizRoot>
  )
}
