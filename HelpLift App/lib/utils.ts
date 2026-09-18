import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Supabase/PostgREST embeds a to-one relation (e.g. donations selecting
// needs(title) via need_id) inconsistently depending on the query shape —
// sometimes a single object, sometimes a one-element array. Code that
// assumed "always array" (`?.[0]`) silently got `undefined` wherever it
// actually came back as an object, breaking both search filters and
// displayed names. This normalizes either shape so callers don't have to
// guess which one a given embed returns.
export function firstOf<T>(value: T | T[] | null | undefined): T | undefined {
  if (value === null || value === undefined) return undefined
  return Array.isArray(value) ? value[0] : value
}
