import type { SupabaseClient } from "@supabase/supabase-js"

export type MaintenanceMode = { enabled: boolean; message: string }
export type WithdrawalLimits = { min: number; max: number | null }
export type PlatformDonationLimits = { min: number; max: number | null }
export type LoginBanner = { enabled: boolean; message: string; attachments: { path: string; name: string }[] }
export type BadgeThresholds = {
  giver: {
    milestoneAmounts: { bronze: number; silver: number; gold: number }
    streakMonths: number
    needsFulfilledMin: number
    categoryChampionMin: number
    wellRoundedCategoriesMin: number
    giftLibraryContributorMin: number
    platformSupporterMin: number
    reachOrgsMin: number
  }
  organization: {
    needsFulfilledAmounts: { bronze: number; silver: number; gold: number }
    fundsRaisedAmounts: { bronze: number; silver: number; gold: number }
    storytellerMin: number
    reliabilityMinRate: number
    reliabilityMinSample: number
    responsivenessMaxHours: number
    responsivenessMinSample: number
  }
}

const DEFAULT_MAINTENANCE: MaintenanceMode = {
  enabled: false,
  message: "HelpLift is undergoing scheduled maintenance. Please check back shortly.",
}
const DEFAULT_WITHDRAWAL_LIMITS: WithdrawalLimits = { min: 100, max: null }
const DEFAULT_PLATFORM_DONATION_LIMITS: PlatformDonationLimits = { min: 20, max: null }
const DEFAULT_LOGIN_BANNER: LoginBanner = { enabled: false, message: "", attachments: [] }
const DEFAULT_BADGE_THRESHOLDS: BadgeThresholds = {
  giver: {
    milestoneAmounts: { bronze: 500, silver: 2500, gold: 10000 },
    streakMonths: 3,
    needsFulfilledMin: 3,
    categoryChampionMin: 5,
    wellRoundedCategoriesMin: 4,
    giftLibraryContributorMin: 3,
    platformSupporterMin: 1,
    reachOrgsMin: 3,
  },
  organization: {
    needsFulfilledAmounts: { bronze: 5, silver: 20, gold: 50 },
    fundsRaisedAmounts: { bronze: 5000, silver: 25000, gold: 100000 },
    storytellerMin: 3,
    reliabilityMinRate: 80,
    reliabilityMinSample: 5,
    responsivenessMaxHours: 48,
    responsivenessMinSample: 3,
  },
}

// Reads one row from platform_settings (see
// 20260924000100_platform_settings.sql). Falls back to the given default if
// the migration hasn't been applied yet, the row is missing, or the value is
// malformed - settings are a convenience, never a reason the app breaks.
async function readSetting<T>(supabase: SupabaseClient, key: string, fallback: T): Promise<T> {
  try {
    const { data, error } = await supabase.from("platform_settings").select("value").eq("key", key).maybeSingle()
    if (error || !data?.value) return fallback
    return { ...fallback, ...(data.value as object) } as T
  } catch {
    return fallback
  }
}

export function getMaintenanceMode(supabase: SupabaseClient): Promise<MaintenanceMode> {
  return readSetting(supabase, "maintenance_mode", DEFAULT_MAINTENANCE)
}

export function getWithdrawalLimits(supabase: SupabaseClient): Promise<WithdrawalLimits> {
  return readSetting(supabase, "withdrawal_limits", DEFAULT_WITHDRAWAL_LIMITS)
}

export function getPlatformDonationLimits(supabase: SupabaseClient): Promise<PlatformDonationLimits> {
  return readSetting(supabase, "platform_donation_limits", DEFAULT_PLATFORM_DONATION_LIMITS)
}

// A dismissible admin note shown on /login - see 20260928000300_login_banner.sql.
export function getLoginBanner(supabase: SupabaseClient): Promise<LoginBanner> {
  return readSetting(supabase, "login_banner", DEFAULT_LOGIN_BANNER)
}

// readSetting's fallback merge is shallow (top-level keys only), so a saved
// value must always carry both "giver" and "organization" in full - the
// admin settings PATCH route enforces that rather than accepting partial
// updates. See 20260927000200_badges.sql for what each threshold gates.
export function getBadgeThresholds(supabase: SupabaseClient): Promise<BadgeThresholds> {
  return readSetting(supabase, "badge_thresholds", DEFAULT_BADGE_THRESHOLDS)
}
