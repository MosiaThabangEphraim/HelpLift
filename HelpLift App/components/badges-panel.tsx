"use client"

import { useEffect, useState } from "react"
import {
  Award,
  BookOpen,
  Calendar,
  CheckCircle2,
  Flame,
  Gift,
  Globe,
  Layers,
  Loader2,
  Lock,
  Medal,
  Banknote,
  ShieldCheck,
  Sparkles,
  Star,
  Target,
  Trophy,
  Zap,
} from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { formatCurrency } from "@/lib/banking"
import { UserAvatar } from "@/components/user-avatar"
import { ShareButtons } from "@/components/share-buttons"

type BadgeStatus = {
  key: string
  label: string
  description: string
  icon: string
  earned: boolean
  earnedAt?: string | null
  progressCurrent?: number
  progressTarget?: number
  unit?: "currency" | "count" | "percent" | "hours"
}

type LeaderboardEntry = { name: string; badgeCount: number; avatarUrl?: string | null; logoUrl?: string | null }
type Leaderboard = { topGivers: LeaderboardEntry[]; topOrganizations: LeaderboardEntry[] }

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  medal: Medal,
  sparkle: Sparkles,
  flame: Flame,
  target: Target,
  trophy: Trophy,
  layers: Layers,
  gift: Gift,
  heart: Award, // kept distinct from the header's own star/award treatment
  globe: Globe,
  calendar: Calendar,
  "book-open": BookOpen,
  "shield-check": ShieldCheck,
  zap: Zap,
  banknote: Banknote,
}

function formatProgressValue(n: number, unit?: BadgeStatus["unit"]) {
  if (unit === "currency") return formatCurrency(n)
  if (unit === "percent") return `${n}%`
  if (unit === "hours") return `${n}h`
  return String(n)
}

function formatEarnedDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-ZA", { year: "numeric", month: "short", day: "numeric" })
}

function BadgeIconTile({ badge, size = "sm" }: { badge: BadgeStatus; size?: "sm" | "lg" }) {
  const Icon = ICONS[badge.icon] || Award
  const dims = size === "lg" ? "p-4" : "p-2.5"
  const iconDims = size === "lg" ? "w-8 h-8" : "w-5 h-5"
  return (
    <div
      className={`shrink-0 rounded ${dims} ${
        badge.earned ? "bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-sm shadow-amber-500/30" : "bg-slate-100 dark:bg-[#1A2740] text-slate-400"
      }`}
    >
      {badge.earned ? <Icon className={iconDims} /> : <Lock className={iconDims} />}
    </div>
  )
}

function ProgressBar({ badge, size = "sm" }: { badge: BadgeStatus; size?: "sm" | "lg" }) {
  if (badge.earned || badge.progressCurrent === undefined || badge.progressTarget === undefined || badge.unit === "hours") return null
  const pct = Math.min(100, Math.round((badge.progressCurrent / Math.max(1, badge.progressTarget)) * 100))
  return (
    <div className="space-y-1">
      <div className={`rounded bg-slate-100 dark:bg-[#1A2740] overflow-hidden ${size === "lg" ? "h-2.5" : "h-1.5"}`}>
        <div className="h-full rounded bg-blue-500" style={{ width: `${pct}%` }} />
      </div>
      <p className={size === "lg" ? "text-xs text-slate-500 dark:text-slate-400" : "text-[11px] text-slate-400"}>
        {formatProgressValue(badge.progressCurrent, badge.unit)} / {formatProgressValue(badge.progressTarget, badge.unit)}
      </p>
    </div>
  )
}

function BadgeCard({ badge, onSelect }: { badge: BadgeStatus; onSelect: (badge: BadgeStatus) => void }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(badge)}
      data-tip="View full details"
      className={`w-full text-left rounded border p-4 space-y-2 transition-colors ${
        badge.earned
          ? "border-amber-200 dark:border-amber-900 bg-amber-50/60 dark:bg-amber-950/20 hover:bg-amber-100/60 dark:hover:bg-amber-950/40"
          : "border-slate-200 dark:border-[#233350] opacity-80 hover:opacity-100 hover:border-slate-300 dark:hover:border-[#2C3E63]"
      }`}
    >
      <div className="flex items-start gap-3">
        <BadgeIconTile badge={badge} />
        <div className="min-w-0">
          <p className="text-sm font-bold truncate">{badge.label}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">{badge.description}</p>
        </div>
      </div>
      {badge.earned && badge.earnedAt && (
        <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-400">Earned {formatEarnedDate(badge.earnedAt)}</p>
      )}
      <ProgressBar badge={badge} />
    </button>
  )
}

function BadgeDetailDialog({ badge, onOpenChange }: { badge: BadgeStatus | null; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={!!badge} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {badge && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                <BadgeIconTile badge={badge} size="lg" />
                <span>{badge.label}</span>
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-1">
              <p className="text-sm text-slate-600 dark:text-slate-300">{badge.description}</p>

              {badge.earned ? (
                <>
                  <div className="flex items-center gap-2 rounded border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 p-3 text-sm font-semibold text-amber-700 dark:text-amber-400">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    {badge.earnedAt ? `Earned on ${formatEarnedDate(badge.earnedAt)}` : "Earned"}
                  </div>
                  <ShareButtons
                    url={typeof window !== "undefined" ? window.location.origin : ""}
                    title={`I just earned the "${badge.label}" badge on HelpLift! ${badge.description}`}
                    label="Share"
                  />
                </>
              ) : (
                <div className="flex items-center gap-2 rounded border border-slate-200 dark:border-[#233350] p-3 text-sm font-semibold text-slate-500 dark:text-slate-400">
                  <Lock className="w-4 h-4 shrink-0" />
                  Not yet earned
                </div>
              )}

              <ProgressBar badge={badge} size="lg" />
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

// Gold/silver/bronze for the top 3, a plain rank number below that.
const RANK_STYLES = [
  "bg-gradient-to-br from-amber-300 to-amber-500 text-white",
  "bg-gradient-to-br from-slate-300 to-slate-400 text-white",
  "bg-gradient-to-br from-orange-300 to-orange-500 text-white",
]

function LeaderboardRow({ rank, entry }: { rank: number; entry: LeaderboardEntry }) {
  const image = entry.avatarUrl || entry.logoUrl
  return (
    <div className="flex items-center gap-3 rounded border border-slate-200 dark:border-[#233350] p-3">
      <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-extrabold ${RANK_STYLES[rank - 1] || "bg-slate-100 dark:bg-[#1A2740] text-slate-500 dark:text-slate-400"}`}>
        {rank}
      </div>
      {/* UserAvatar (not a bare <img>) so a broken/expired photo URL - a
          hotlinked Google avatar, for instance - falls back to the entry's
          initial the same way it does everywhere else in the app, instead of
          the browser's own broken-image render. */}
      <UserAvatar src={image} name={entry.name} className="size-9 border border-slate-200 dark:border-[#233350]" />
      <p className="min-w-0 flex-1 truncate text-sm font-bold">{entry.name}</p>
      <span className="flex shrink-0 items-center gap-1 rounded bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 text-xs font-bold text-amber-700 dark:text-amber-400">
        <Trophy className="h-3 w-3" /> {entry.badgeCount}
      </span>
    </div>
  )
}

// Top givers and organizations by badge count - see app/api/leaderboard for
// where this comes from (badge_awards, not a recomputation of every badge
// for every user, which would be far too expensive to rank by).
function LeaderboardView() {
  const [data, setData] = useState<Leaderboard | null>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    let cancelled = false
    fetch("/api/leaderboard")
      .then(async (res) => {
        const body = await res.json().catch(() => ({}))
        if (cancelled) return
        if (res.ok) setData({ topGivers: body.topGivers || [], topOrganizations: body.topOrganizations || [] })
        else setError(body.message || "Could not load the leaderboard.")
      })
      .catch(() => { if (!cancelled) setError("Could not load the leaderboard.") })
    return () => { cancelled = true }
  }, [])

  if (error) return <div className="rounded bg-red-50 dark:bg-red-950/40 p-3 text-sm font-semibold text-red-700 dark:text-red-300">{error}</div>
  if (!data) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-amber-600" /></div>

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Top organizations</h3>
        {data.topOrganizations.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">No badges earned yet - be the first!</p>
        ) : (
          <div className="space-y-2">
            {data.topOrganizations.map((entry, i) => <LeaderboardRow key={entry.name + i} rank={i + 1} entry={entry} />)}
          </div>
        )}
      </div>
      <div className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Top givers</h3>
        {data.topGivers.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">No badges earned yet - be the first!</p>
        ) : (
          <div className="space-y-2">
            {data.topGivers.map((entry, i) => <LeaderboardRow key={entry.name + i} rank={i + 1} entry={entry} />)}
          </div>
        )}
      </div>
    </div>
  )
}

// Shared by both the giver and organization dashboards - fetches from
// whichever badges endpoint fits that dashboard (the badges themselves are
// role-specific; the display is not). See lib/badges.ts for how each badge
// is computed, and app/api/giver/badges + app/api/organization/badges for
// the endpoints this fetches from.
export function BadgesPanel({ endpoint, refreshKey = 0 }: { endpoint: string; refreshKey?: number }) {
  // refreshKey: bumped by the dashboard's refresh button to re-fetch in place (filters are kept).
  const [view, setView] = useState<"badges" | "leaderboard">("badges")
  const [badges, setBadges] = useState<BadgeStatus[] | null>(null)
  const [error, setError] = useState("")
  const [selectedBadge, setSelectedBadge] = useState<BadgeStatus | null>(null)

  useEffect(() => {
    let cancelled = false
    setBadges(null)
    setError("")
    fetch(endpoint)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (cancelled) return
        if (res.ok) setBadges(data.badges || [])
        else setError(data.message || "Could not load badges.")
      })
      .catch(() => { if (!cancelled) setError("Could not load badges.") })
    return () => { cancelled = true }
  }, [endpoint, refreshKey])

  const earnedBadges = (badges || []).filter((b) => b.earned)
  const inProgressBadges = (badges || []).filter((b) => !b.earned)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="rounded bg-gradient-to-br from-amber-400 to-orange-500 p-3 text-white shadow-lg shadow-amber-500/20">
            <Star className="w-6 h-6" fill="currentColor" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold">{view === "badges" ? "Badges" : "Leaderboard"}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {view === "badges"
                ? badges ? `${earnedBadges.length} of ${badges.length} earned` : "Your achievements on HelpLift"
                : "Top givers and organizations by badges earned"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 rounded border border-slate-200 dark:border-[#233350] p-1">
          {(["badges", "leaderboard"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setView(option)}
              aria-pressed={view === option}
              className={`rounded px-3.5 py-1.5 text-xs font-bold capitalize transition-colors ${
                view === option
                  ? "bg-amber-500 text-white"
                  : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#1A2740]"
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      {view === "leaderboard" ? (
        <LeaderboardView />
      ) : (
        <>
          {error && (
            <div className="rounded bg-red-50 dark:bg-red-950/40 p-3 text-sm font-semibold text-red-700 dark:text-red-300">{error}</div>
          )}

          {!badges && !error && (
            <div className="flex justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-amber-600" />
            </div>
          )}

          {badges && (
            <>
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Earned</h3>
                {earnedBadges.length === 0 ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400">No badges earned yet - keep going!</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                    {earnedBadges.map((b) => <BadgeCard key={b.key} badge={b} onSelect={setSelectedBadge} />)}
                  </div>
                )}
              </div>

              {inProgressBadges.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">In progress</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                    {inProgressBadges.map((b) => <BadgeCard key={b.key} badge={b} onSelect={setSelectedBadge} />)}
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      <BadgeDetailDialog badge={selectedBadge} onOpenChange={(open) => !open && setSelectedBadge(null)} />
    </div>
  )
}
