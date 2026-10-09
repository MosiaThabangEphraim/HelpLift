"use client"

import { useEffect, useState } from "react"
import { CheckCircle2, LayoutGrid, X } from "lucide-react"

// Phone-only navigation for dashboards with many sections (md:hidden; the
// desktop tab bar is untouched). Replaces the long sideways-scrolling tab row
// with what modern mobile apps use:
// - a bottom bar with the few sections used most, plus "More"
// - "More" opens a bottom sheet with every other section as a grid of tiles
// - a small heading above the content naming the current section
// Counts show as badges, so nothing waiting for attention is hidden.
// The sheet can also hold quick actions (buttons that live in the desktop
// header, such as Badges or Message Admin), so the phone header stays short.

export type MobileSection = {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  /** Waiting-for-attention count; shown as a badge when above zero. */
  count?: number
  /** Tailwind gradient for the tile icon, e.g. "from-blue-500 to-indigo-600". */
  gradient: string
  /** One short line under the tile label in the "More" sheet. */
  hint?: string
}

export type MobileAction = {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  gradient: string
  onClick: () => void
  hint?: string
}

function Badge({ value, className = "" }: { value?: number; className?: string }) {
  if (!value) return null
  return (
    <span className={`inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white ${className}`}>
      {value > 99 ? "99+" : value}
    </span>
  )
}

/** Heading above the content on phones, naming the section that's open. */
export function MobileSectionHeading({ section }: { section?: MobileSection }) {
  if (!section) return null
  const Icon = section.icon
  return (
    <div className="md:hidden flex items-center gap-3">
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${section.gradient} text-white shadow-md`}>
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <h2 className="truncate text-lg font-extrabold leading-tight">{section.label}</h2>
        {section.hint && <p className="truncate text-xs text-slate-500 dark:text-slate-400">{section.hint}</p>}
      </div>
    </div>
  )
}

export function MobileSectionNav({
  primary,
  more,
  actions = [],
  active,
  onSelect,
}: {
  /** Up to four sections always on the bottom bar. */
  primary: MobileSection[]
  /** Everything else, in the "More" sheet. */
  more: MobileSection[]
  /** Quick actions shown under the sections in the "More" sheet. */
  actions?: MobileAction[]
  active: string
  onSelect: (id: string) => void
}) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const moreActive = more.some(section => section.id === active)
  const moreCount = more.reduce((sum, section) => sum + (section.count || 0), 0)

  // Close the sheet with Escape, and keep the page behind it still.
  useEffect(() => {
    if (!sheetOpen) return
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setSheetOpen(false) }
    const overflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    // Hides Lifty's button while the sheet is open (globals.css).
    document.body.dataset.mobileSheetOpen = "true"
    window.addEventListener("keydown", onKey)
    return () => {
      window.removeEventListener("keydown", onKey)
      document.body.style.overflow = overflow
      delete document.body.dataset.mobileSheetOpen
    }
  }, [sheetOpen])

  const choose = (id: string) => {
    setSheetOpen(false)
    onSelect(id)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  return (
    <>
      {/* Bottom bar. data-mobile-bottom-nav lifts Lifty's button above it (globals.css). */}
      <nav
        data-mobile-bottom-nav
        aria-label="Sections"
        className="md:hidden fixed inset-x-0 bottom-0 z-[140] bg-white/95 dark:bg-[#0E1729]/95 backdrop-blur-xl shadow-[0_-8px_30px_-12px_rgba(15,23,42,0.25)] pb-[env(safe-area-inset-bottom)]"
      >
        <div className="grid grid-cols-5 px-1.5 pt-1.5 pb-1">
          {[...primary, null].map(section => {
            const isMore = section === null
            const isActive = isMore ? moreActive || sheetOpen : section.id === active
            const Icon = isMore ? LayoutGrid : section.icon
            const label = isMore ? "More" : section.label
            const count = isMore ? moreCount : section.count
            return (
              <button
                key={isMore ? "more" : section.id}
                type="button"
                onClick={() => (isMore ? setSheetOpen(open => !open) : choose(section.id))}
                aria-current={!isMore && isActive ? "page" : undefined}
                aria-expanded={isMore ? sheetOpen : undefined}
                aria-label={count ? `${label}, ${count} waiting` : label}
                data-tip={isMore ? "All other sections" : count ? `${label}: ${count} waiting` : label}
                className="flex flex-col items-center gap-0.5 py-1 text-[10px] font-bold"
              >
                <span
                  className={`relative flex h-8 w-12 items-center justify-center rounded-full transition-all duration-200 ${
                    isActive ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-600/30" : "text-slate-500 dark:text-slate-400"
                  }`}
                >
                  <Icon className="h-[18px] w-[18px]" />
                  <Badge value={count} className="absolute -top-1 right-0.5" />
                </span>
                <span className={`max-w-full truncate ${isActive ? "text-blue-700 dark:text-blue-300" : "text-slate-500 dark:text-slate-400"}`}>{label}</span>
              </button>
            )
          })}
        </div>
      </nav>

      {/* "More" sheet - under the bottom bar, which stays visible with More highlighted. */}
      {sheetOpen && (
        <div className="md:hidden fixed inset-0 z-[135]" role="dialog" aria-modal="true" aria-label="All sections">
          <button type="button" aria-label="Close" onClick={() => setSheetOpen(false)} className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px] animate-in fade-in duration-200" />
          <div className="absolute inset-x-0 bottom-0 max-h-[80vh] overflow-y-auto rounded-t-3xl bg-white dark:bg-[#0E1729] px-4 pt-3 pb-[calc(5.5rem+env(safe-area-inset-bottom))] shadow-2xl animate-in slide-in-from-bottom duration-300">
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-slate-200 dark:bg-slate-700" />
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-extrabold">{more.length > 0 ? "All sections" : "Quick actions"}</p>
              <button type="button" onClick={() => setSheetOpen(false)} aria-label="Close" className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {more.map(section => {
                const Icon = section.icon
                const isActive = section.id === active
                return (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => choose(section.id)}
                    aria-current={isActive ? "page" : undefined}
                    data-tip={section.hint || section.label}
                    className={`relative flex flex-col items-center gap-2 rounded-2xl px-2 py-3 text-center transition-colors ${
                      isActive ? "bg-blue-50 dark:bg-blue-950/50" : "bg-slate-50 dark:bg-slate-800/50 active:bg-slate-100 dark:active:bg-slate-800"
                    }`}
                  >
                    <span className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${section.gradient} text-white shadow-md`}>
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="text-[11px] font-bold leading-tight text-slate-800 dark:text-slate-100">{section.label}</span>
                    <Badge value={section.count} className="absolute right-2 top-2" />
                  </button>
                )
              })}
            </div>
            {actions.length > 0 && (
              <>
                {more.length > 0 && <p className="mb-3 mt-5 text-sm font-extrabold">Quick actions</p>}
                <div className="grid grid-cols-3 gap-2">
                  {actions.map(action => {
                    const Icon = action.icon
                    return (
                      <button
                        key={action.id}
                        type="button"
                        onClick={() => { setSheetOpen(false); action.onClick() }}
                        data-tip={action.hint || action.label}
                        className="flex flex-col items-center gap-2 rounded-2xl bg-slate-50 dark:bg-slate-800/50 px-2 py-3 text-center active:bg-slate-100 dark:active:bg-slate-800"
                      >
                        <span className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${action.gradient} text-white shadow-md`}>
                          <Icon className="h-5 w-5" />
                        </span>
                        <span className="text-[11px] font-bold leading-tight text-slate-800 dark:text-slate-100">{action.label}</span>
                      </button>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}

/** Phone-only "needs attention" line: a small chip per section with something
 *  waiting (tap to open it), or one "All caught up" line when nothing is. */
export function MobileAttentionGrid({ items, onSelect }: {
  items: { id: string; label: string; value: number; icon: React.ComponentType<{ className?: string }>; tone: string }[]
  onSelect: (id: string) => void
}) {
  const waiting = items.filter(item => item.value > 0)
  if (waiting.length === 0) {
    return (
      <p className="md:hidden flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
        <CheckCircle2 className="h-4 w-4 text-emerald-500" /> All caught up - nothing waiting for review.
      </p>
    )
  }
  return (
    <div className="md:hidden flex flex-wrap gap-1.5" aria-label="Waiting for review">
      {waiting.map(({ id, label, value, icon: Icon, tone }) => (
        <button
          key={label}
          type="button"
          onClick={() => { onSelect(id); window.scrollTo({ top: 0, behavior: "smooth" }) }}
          data-tip={`Open ${label}`}
          className="inline-flex items-center gap-1.5 rounded-full bg-white dark:bg-[#121B2E] px-2.5 py-1 text-xs font-semibold shadow-sm transition-transform active:scale-95"
        >
          <Icon className={`h-3.5 w-3.5 ${tone}`} />
          <span className="font-extrabold">{value}</span>
          <span className="text-slate-500 dark:text-slate-400">{label}</span>
        </button>
      ))}
    </div>
  )
}
