// Needs and Gift Library offerings have an end date: a need's due date and a
// gift's expiry date. Both count as still current ON that date (South African
// time) and as past from the next day:
// - Public lists (Needs board, map, Gift Library, organization profiles,
//   Lifty) hide anything past its date straight away, using notPastFilter().
// - public.expire_overdue_items() (20261008000300_expire_overdue_needs_and_gifts.sql)
//   closes open needs past their due date and marks gifts past their expiry
//   date as expired, and notifies the organization or giver - daily on a
//   pg_cron schedule, and also via lib/expiry-job.ts when the public lists
//   load, so it works without pg_cron.
// Money never expires: donations have no end date, and financial Gift Library
// pledges (already paid) are never expired.

export const SA_TIME_ZONE = "Africa/Johannesburg"

/** Today's date in South Africa, as YYYY-MM-DD. */
export function todayInSA(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: SA_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(now)
}

/** True when a YYYY-MM-DD date (or timestamp) is before today in South Africa. */
export function isPastDate(date: string | null | undefined) {
  if (!date) return false
  return date.slice(0, 10) < todayInSA()
}

/** PostgREST `or` filter: no date set, or the date is today or later. */
export function notPastFilter(column: "due_date" | "expiry_date") {
  return `${column}.is.null,${column}.gte.${todayInSA()}`
}
