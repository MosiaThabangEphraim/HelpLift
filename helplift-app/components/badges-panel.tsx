"use client"

import { useEffect, useRef, useState } from "react"
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
import { CountUp } from "@/components/count-up"

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

// Motion that follows the pointer (the card tilt) is done in JS, so it checks
// the Reduce motion setting and the device's own preference itself; the CSS
// animations in globals.css are switched off by those automatically.
function motionAllowed() {
  if (typeof window === "undefined") return false
  if (document.documentElement.classList.contains("reduce-motion")) return false
  return !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
}

function progressPercent(badge: BadgeStatus) {
  if (badge.progressCurrent === undefined || badge.progressTarget === undefined) return null
  return Math.min(100, Math.round((badge.progressCurrent / Math.max(1, badge.progressTarget)) * 100))
}

function BadgeIconTile({ badge, size = "sm", pop = false, shineDelay = 0 }: { badge: BadgeStatus; size?: "sm" | "lg"; pop?: boolean; shineDelay?: number }) {
  const Icon = ICONS[badge.icon] || Award
  const dims = size === "lg" ? "p-4" : "p-2.5"
  const iconDims = size === "lg" ? "w-8 h-8" : "w-5 h-5"
  return (
    <div
      className={`shrink-0 rounded ${dims} transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6 ${pop ? "badge-pop" : ""} ${
        badge.earned
          ? "badge-shine bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-sm shadow-blue-500/30"
          : "bg-slate-100 dark:bg-[#1A2740] text-slate-400"
      }`}
      style={badge.earned ? ({ "--shine-delay": `${shineDelay}s` } as React.CSSProperties) : undefined}
    >
      {badge.earned ? <Icon className={iconDims} /> : <Lock className={`${iconDims} badge-wiggle`} />}
    </div>
  )
}

// Fills from empty to its value when it appears, with a moving highlight.
function ProgressBar({ badge, size = "sm" }: { badge: BadgeStatus; size?: "sm" | "lg" }) {
  const pct = progressPercent(badge)
  const [shown, setShown] = useState(0)
  useEffect(() => {
    if (pct === null) return
    const timer = window.setTimeout(() => setShown(pct), 80)
    return () => window.clearTimeout(timer)
  }, [pct])
  if (badge.earned || pct === null || badge.unit === "hours") return null
  const remaining = Math.max(0, (badge.progressTarget ?? 0) - (badge.progressCurrent ?? 0))
  return (
    <div className="space-y-1">
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label={`${badge.label} progress`}
        className={`rounded bg-slate-100 dark:bg-[#1A2740] overflow-hidden ${size === "lg" ? "h-2.5" : "h-1.5"}`}
      >
        <div
          className={`relative h-full overflow-hidden rounded bg-gradient-to-r from-blue-500 to-indigo-500 transition-[width] duration-1000 ease-out ${shown > 0 ? "badge-progress-shimmer" : ""}`}
          style={{ width: `${shown}%` }}
        />
      </div>
      <p className={`flex justify-between gap-2 ${size === "lg" ? "text-xs text-slate-500 dark:text-slate-400" : "text-[11px] text-slate-400"}`}>
        <span>{formatProgressValue(badge.progressCurrent!, badge.unit)} / {formatProgressValue(badge.progressTarget!, badge.unit)}</span>
        {size === "lg" && remaining > 0 && <span className="font-semibold">{formatProgressValue(remaining, badge.unit)} to go</span>}
      </p>
    </div>
  )
}

function BadgeCard({
  badge,
  index,
  isNextUp,
  onSelect,
}: {
  badge: BadgeStatus
  index: number
  isNextUp: boolean
  onSelect: (badge: BadgeStatus) => void
}) {
  const cardRef = useRef<HTMLButtonElement>(null)

  // A gentle 3D tilt towards the pointer.
  const tilt = (event: React.PointerEvent<HTMLButtonElement>) => {
    const card = cardRef.current
    if (!card || event.pointerType !== "mouse" || !motionAllowed()) return
    const rect = card.getBoundingClientRect()
    const x = (event.clientX - rect.left) / rect.width - 0.5
    const y = (event.clientY - rect.top) / rect.height - 0.5
    card.style.transform = `perspective(700px) rotateX(${(-y * 7).toFixed(2)}deg) rotateY(${(x * 7).toFixed(2)}deg) translateY(-3px)`
  }
  const resetTilt = () => {
    if (cardRef.current) cardRef.current.style.transform = ""
  }

  return (
    // The entrance animation sits on a wrapper so it never fights the tilt.
    <div className="badge-rise" style={{ animationDelay: `${Math.min(index, 12) * 55}ms` }}>
      <button
        ref={cardRef}
        type="button"
        onClick={() => onSelect(badge)}
        onPointerMove={tilt}
        onPointerLeave={resetTilt}
        data-tip="View full details"
        className={`group relative h-full w-full text-left rounded border p-4 space-y-2 transition-[transform,box-shadow,background-color,border-color,opacity] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.98] will-change-transform ${
          badge.earned
            ? "border-blue-200 dark:border-blue-900 bg-blue-50/60 dark:bg-blue-950/20 hover:bg-blue-100/60 dark:hover:bg-blue-950/40 hover:shadow-blue-500/10"
            : isNextUp
            ? "badge-glow border-indigo-300 dark:border-indigo-800 bg-white dark:bg-[#121B2E]"
            : "border-slate-200 dark:border-[#233350] opacity-80 hover:opacity-100 hover:border-slate-300 dark:hover:border-[#2C3E63]"
        }`}
      >
        {isNextUp && (
          <span className="absolute -top-2 right-3 rounded bg-indigo-600 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm">
            Next up
          </span>
        )}
        <div className="flex items-start gap-3">
          <BadgeIconTile badge={badge} shineDelay={(index % 6) * 0.7} />
          <div className="min-w-0">
            <p className="text-sm font-bold truncate">{badge.label}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">{badge.description}</p>
          </div>
        </div>
        {badge.earned && badge.earnedAt && (
          <p className="text-[11px] font-semibold text-blue-700 dark:text-blue-300">Earned {formatEarnedDate(badge.earnedAt)}</p>
        )}
        <ProgressBar badge={badge} />
      </button>
    </div>
  )
}

// A burst of confetti from behind an earned badge's icon.
const CONFETTI_COLORS = ["#f59e0b", "#f97316", "#3b82f6", "#10b981", "#ec4899", "#8b5cf6"]
const CONFETTI = Array.from({ length: 18 }, (_, i) => {
  const angle = (i / 18) * Math.PI * 2
  const distance = 55 + (i % 3) * 22
  return {
    x: `${Math.round(Math.cos(angle) * distance)}px`,
    y: `${Math.round(Math.sin(angle) * distance - 18)}px`,
    r: `${(i % 2 ? 1 : -1) * (180 + i * 25)}deg`,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    round: i % 3 === 0,
  }
})

function ConfettiBurst() {
  return (
    <span aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/2">
      {CONFETTI.map((piece, i) => (
        <span
          key={i}
          className={`badge-confetti absolute block h-2 ${piece.round ? "w-2 rounded-full" : "w-1.5 rounded-sm"}`}
          style={{ backgroundColor: piece.color, animationDelay: `${120 + (i % 4) * 30}ms`, ["--x" as any]: piece.x, ["--y" as any]: piece.y, ["--r" as any]: piece.r }}
        />
      ))}
    </span>
  )
}

function BadgeDetailDialog({ badge, onOpenChange }: { badge: BadgeStatus | null; onOpenChange: (open: boolean) => void }) {
  const pct = badge ? progressPercent(badge) : null
  return (
    <Dialog open={!!badge} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {badge && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                {/* key: replays the pop (and confetti) each time a badge opens */}
                <span key={badge.key} className="relative">
                  {badge.earned && <ConfettiBurst />}
                  <BadgeIconTile badge={badge} size="lg" pop />
                </span>
                <span className="animate-in fade-in slide-in-from-left-2 duration-500">{badge.label}</span>
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-1 animate-in fade-in slide-in-from-bottom-2 duration-500">
              <p className="text-sm text-slate-600 dark:text-slate-300">{badge.description}</p>

              {badge.earned ? (
                <>
                  <div className="flex items-center gap-2 rounded border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/30 p-3 text-sm font-semibold text-blue-700 dark:text-blue-300">
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
                  {pct !== null && pct > 0 && badge.unit !== "hours" ? `Not yet earned - you're ${pct}% of the way there` : "Not yet earned"}
                </div>
              )}

              <ProgressBar key={badge.key} badge={badge} size="lg" />
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

function LeaderboardRow({ rank, entry, index }: { rank: number; entry: LeaderboardEntry; index: number }) {
  const image = entry.avatarUrl || entry.logoUrl
  return (
    <div
      className="badge-rise group flex items-center gap-3 rounded border border-slate-200 dark:border-[#233350] p-3 transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-blue-200 dark:hover:border-blue-900"
      style={{ animationDelay: `${Math.min(index, 10) * 60}ms` }}
    >
      <div
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-extrabold transition-transform duration-300 group-hover:scale-110 ${rank <= 3 ? "badge-shine" : ""} ${RANK_STYLES[rank - 1] || "bg-slate-100 dark:bg-[#1A2740] text-slate-500 dark:text-slate-400"}`}
        style={rank <= 3 ? ({ "--shine-delay": `${rank * 0.6}s` } as React.CSSProperties) : undefined}
      >
        {rank}
      </div>
      {/* UserAvatar (not a bare <img>) so a broken/expired photo URL - a
          hotlinked Google avatar, for instance - falls back to the entry's
          initial the same way it does everywhere else in the app, instead of
          the browser's own broken-image render. */}
      <UserAvatar src={image} name={entry.name} className="size-9 border border-slate-200 dark:border-[#233350]" />
      <p className="min-w-0 flex-1 truncate text-sm font-bold">{entry.name}</p>
      <span className="flex shrink-0 items-center gap-1 rounded bg-blue-50 dark:bg-blue-950/40 px-2.5 py-1 text-xs font-bold text-blue-700 dark:text-blue-300">
        <Trophy className="h-3 w-3 transition-transform duration-300 group-hover:-rotate-12 group-hover:scale-125" /> <CountUp value={entry.badgeCount} duration={900} />
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
  if (!data) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Top organizations</h3>
        {data.topOrganizations.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">No badges earned yet - be the first!</p>
        ) : (
          <div className="space-y-2">
            {data.topOrganizations.map((entry, i) => <LeaderboardRow key={entry.name + i} rank={i + 1} entry={entry} index={i} />)}
          </div>
        )}
      </div>
      <div className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Top givers</h3>
        {data.topGivers.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">No badges earned yet - be the first!</p>
        ) : (
          <div className="space-y-2">
            {data.topGivers.map((entry, i) => <LeaderboardRow key={entry.name + i} rank={i + 1} entry={entry} index={i} />)}
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
  // The in-progress badge you're closest to earning gets a "Next up" highlight.
  const nextUpKey = inProgressBadges
    .filter((b) => b.unit !== "hours" && (progressPercent(b) ?? 0) > 0)
    .sort((a, b) => (progressPercent(b) ?? 0) - (progressPercent(a) ?? 0))[0]?.key
  const earnedShare = badges && badges.length ? Math.round((earnedBadges.length / badges.length) * 100) : 0
  const [headerFill, setHeaderFill] = useState(0)
  useEffect(() => {
    const timer = window.setTimeout(() => setHeaderFill(earnedShare), 120)
    return () => window.clearTimeout(timer)
  }, [earnedShare])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="badge-shine badge-pop rounded bg-gradient-to-br from-blue-500 to-indigo-600 p-3 text-white shadow-lg shadow-blue-500/20 transition-transform duration-300 hover:rotate-12 hover:scale-110">
            <Star className="w-6 h-6" fill="currentColor" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold">{view === "badges" ? "Badges" : "Leaderboard"}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {view === "badges"
                ? badges ? <><CountUp value={earnedBadges.length} duration={900} /> of {badges.length} earned</> : "Your achievements on HelpLift"
                : "Top givers and organizations by badges earned"}
            </p>
            {view === "badges" && badges && badges.length > 0 && (
              <div className="mt-1.5 h-1.5 w-40 overflow-hidden rounded bg-slate-100 dark:bg-[#1A2740]" aria-hidden="true">
                <div className="relative h-full overflow-hidden rounded bg-gradient-to-r from-blue-500 to-indigo-600 transition-[width] duration-1000 ease-out badge-progress-shimmer" style={{ width: `${headerFill}%` }} />
              </div>
            )}
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
                  ? "bg-blue-600 text-white"
                  : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#1A2740]"
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      <div key={view} className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-6">
      {view === "leaderboard" ? (
        <LeaderboardView />
      ) : (
        <>
          {error && (
            <div className="rounded bg-red-50 dark:bg-red-950/40 p-3 text-sm font-semibold text-red-700 dark:text-red-300">{error}</div>
          )}

          {!badges && !error && (
            <div className="flex justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
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
                    {earnedBadges.map((b, i) => <BadgeCard key={b.key} badge={b} index={i} isNextUp={false} onSelect={setSelectedBadge} />)}
                  </div>
                )}
              </div>

              {inProgressBadges.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">In progress</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 pt-1">
                    {inProgressBadges.map((b, i) => <BadgeCard key={b.key} badge={b} index={earnedBadges.length + i} isNextUp={b.key === nextUpKey} onSelect={setSelectedBadge} />)}
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
      </div>

      <BadgeDetailDialog badge={selectedBadge} onOpenChange={(open) => !open && setSelectedBadge(null)} />
    </div>
  )
}
