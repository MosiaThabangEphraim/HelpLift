// Small helpers shared by the giver and organization analytics views.

export type AnalyticsRange = 6 | 12 | "all"

export const RANGE_OPTIONS: { value: AnalyticsRange; label: string }[] = [
  { value: 6, label: "Last 6 months" },
  { value: 12, label: "Last 12 months" },
  { value: "all", label: "All time" },
]

const MAX_ALL_TIME_MONTHS = 36

export type MonthPoint = { key: string; label: string; value: number }
export type RankedPoint = { name: string; value: number }

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
}

function monthLabel(date: Date) {
  return date.toLocaleDateString(undefined, { month: "short", year: "2-digit" })
}

// First day of the earliest month in the range, or null for "all time".
export function rangeStart(range: AnalyticsRange): Date | null {
  if (range === "all") return null
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth() - (range - 1), 1)
}

export function inRange(value: string | null | undefined, start: Date | null): boolean {
  if (!value) return false
  if (!start) return true
  const time = new Date(value).getTime()
  return !Number.isNaN(time) && time >= start.getTime()
}

// One point per calendar month, including months with nothing in them, so gaps
// show as gaps instead of being silently skipped.
export function bucketByMonth<T>(
  items: T[],
  getDate: (item: T) => string | null | undefined,
  getValue: (item: T) => number,
  range: AnalyticsRange
): MonthPoint[] {
  const now = new Date()
  let start = rangeStart(range)
  if (!start) {
    const times = items.map(item => new Date(getDate(item) || "").getTime()).filter(time => !Number.isNaN(time))
    const earliest = times.length ? new Date(Math.min(...times)) : now
    start = new Date(earliest.getFullYear(), earliest.getMonth(), 1)
    const floor = new Date(now.getFullYear(), now.getMonth() - (MAX_ALL_TIME_MONTHS - 1), 1)
    if (start < floor) start = floor
  }

  const points = new Map<string, MonthPoint>()
  for (let cursor = new Date(start); cursor <= now; cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)) {
    points.set(monthKey(cursor), { key: monthKey(cursor), label: monthLabel(cursor), value: 0 })
  }
  for (const item of items) {
    const raw = getDate(item)
    if (!raw) continue
    const date = new Date(raw)
    if (Number.isNaN(date.getTime())) continue
    const point = points.get(monthKey(date))
    if (point) point.value += getValue(item)
  }
  return [...points.values()]
}

export function countBy<T>(items: T[], getKey: (item: T) => string | null | undefined): RankedPoint[] {
  const counts = new Map<string, number>()
  for (const item of items) {
    const key = getKey(item)
    if (!key) continue
    counts.set(key, (counts.get(key) || 0) + 1)
  }
  return [...counts.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
}

export function sumBy<T>(items: T[], getKey: (item: T) => string | null | undefined, getValue: (item: T) => number): RankedPoint[] {
  const sums = new Map<string, number>()
  for (const item of items) {
    const key = getKey(item)
    if (!key) continue
    sums.set(key, (sums.get(key) || 0) + getValue(item))
  }
  return [...sums.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
}

// Keep the largest few; the rest are left out (the chart says "top N").
export function topN(points: RankedPoint[], count: number): RankedPoint[] {
  return points.slice(0, count)
}

// Fixed order for a known set of statuses (keeps the bars in a meaningful order
// and shows zero rows so a missing status is visible, not absent).
export function byStatusOrder(points: RankedPoint[], order: { key: string; label: string }[]): RankedPoint[] {
  const lookup = new Map(points.map(point => [point.name, point.value]))
  return order.map(({ key, label }) => ({ name: label, value: lookup.get(key) || 0 }))
}

export function percent(part: number, whole: number): number | null {
  if (!whole) return null
  return Math.round((part / whole) * 100)
}

// 1,284 / 12.9K / 4.2M, for axis ticks and compact figures.
export function compactNumber(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1).replace(/\.0$/, "")}M`
  if (abs >= 10_000) return `${Math.round(value / 1000)}K`
  if (abs >= 1000) return `${(value / 1000).toFixed(1).replace(/\.0$/, "")}K`
  return String(Math.round(value))
}

export function firstOf<T>(value: T | T[] | null | undefined): T | undefined {
  return Array.isArray(value) ? value[0] : value ?? undefined
}
