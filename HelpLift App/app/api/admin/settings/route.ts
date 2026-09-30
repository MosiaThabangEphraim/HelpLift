import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getMaintenanceMode, getWithdrawalLimits, getPlatformDonationLimits, getBadgeThresholds, getLoginBanner } from "@/lib/platform-settings"

// The PATCH here always replaces the whole badge_thresholds object (never a
// partial), since readSetting's fallback merge in lib/platform-settings.ts
// only merges shallowly at the top level - see getBadgeThresholds's comment.
function validateBadgeThresholds(value: any): string | null {
  const isPosNum = (n: unknown) => typeof n === "number" && Number.isFinite(n) && n >= 0
  const g = value?.giver
  const o = value?.organization
  if (!g || !o) return "Provide both giver and organization thresholds."

  const gTiers = g.milestoneAmounts
  if (!gTiers || !isPosNum(gTiers.bronze) || !isPosNum(gTiers.silver) || !isPosNum(gTiers.gold) || !(gTiers.bronze <= gTiers.silver && gTiers.silver <= gTiers.gold)) {
    return "Giver milestone amounts must be zero or more, and Bronze ≤ Silver ≤ Gold."
  }
  if (!isPosNum(g.streakMonths) || g.streakMonths < 1) return "Giver streak months must be at least 1."
  if (!isPosNum(g.needsFulfilledMin) || g.needsFulfilledMin < 1) return "Giver needs-fulfilled minimum must be at least 1."
  if (!isPosNum(g.categoryChampionMin) || g.categoryChampionMin < 1) return "Giver category champion minimum must be at least 1."
  if (!isPosNum(g.wellRoundedCategoriesMin) || g.wellRoundedCategoriesMin < 1) return "Giver well-rounded categories minimum must be at least 1."
  if (!isPosNum(g.giftLibraryContributorMin) || g.giftLibraryContributorMin < 1) return "Giver Gift Library contributor minimum must be at least 1."
  if (!isPosNum(g.platformSupporterMin) || g.platformSupporterMin < 1) return "Giver platform supporter minimum must be at least 1."
  if (!isPosNum(g.reachOrgsMin) || g.reachOrgsMin < 1) return "Giver reach minimum must be at least 1."

  const oNeeds = o.needsFulfilledAmounts
  if (!oNeeds || !isPosNum(oNeeds.bronze) || !isPosNum(oNeeds.silver) || !isPosNum(oNeeds.gold) || !(oNeeds.bronze <= oNeeds.silver && oNeeds.silver <= oNeeds.gold)) {
    return "Organization needs-fulfilled amounts must be zero or more, and Bronze ≤ Silver ≤ Gold."
  }
  const oFunds = o.fundsRaisedAmounts
  if (!oFunds || !isPosNum(oFunds.bronze) || !isPosNum(oFunds.silver) || !isPosNum(oFunds.gold) || !(oFunds.bronze <= oFunds.silver && oFunds.silver <= oFunds.gold)) {
    return "Organization funds-raised amounts must be zero or more, and Bronze ≤ Silver ≤ Gold."
  }
  if (!isPosNum(o.storytellerMin) || o.storytellerMin < 1) return "Organization storyteller minimum must be at least 1."
  if (!isPosNum(o.reliabilityMinRate) || o.reliabilityMinRate < 0 || o.reliabilityMinRate > 100) return "Organization reliability rate must be between 0 and 100."
  if (!isPosNum(o.reliabilityMinSample) || o.reliabilityMinSample < 1) return "Organization reliability sample size must be at least 1."
  if (!isPosNum(o.responsivenessMaxHours) || o.responsivenessMaxHours < 1) return "Organization responsiveness hours must be at least 1."
  if (!isPosNum(o.responsivenessMinSample) || o.responsivenessMinSample < 1) return "Organization responsiveness sample size must be at least 1."

  return null
}

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ message: "Authentication required." }, { status: 401 }) }
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
  if (profile?.role !== "admin") return { error: NextResponse.json({ message: "Administrator access required." }, { status: 403 }) }
  return { user }
}

export async function GET() {
  try {
    const supabase = await createClient()
    const auth = await requireAdmin(supabase)
    if (auth.error) return auth.error
    const [maintenanceMode, withdrawalLimits, platformDonationLimits, badgeThresholds, loginBanner] = await Promise.all([
      getMaintenanceMode(supabase),
      getWithdrawalLimits(supabase),
      getPlatformDonationLimits(supabase),
      getBadgeThresholds(supabase),
      getLoginBanner(supabase),
    ])
    return NextResponse.json({ maintenanceMode, withdrawalLimits, platformDonationLimits, badgeThresholds, loginBanner })
  } catch (error) {
    console.error("Admin settings load error:", error)
    return NextResponse.json({ message: "Settings are unavailable." }, { status: 503 })
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient()
    const auth = await requireAdmin(supabase)
    if (auth.error) return auth.error

    const body = await request.json().catch(() => ({}))
    const { key, value } = body
    if (key !== "maintenance_mode" && key !== "withdrawal_limits" && key !== "platform_donation_limits" && key !== "badge_thresholds" && key !== "login_banner") {
      return NextResponse.json({ message: "Unknown setting." }, { status: 400 })
    }

    if (key === "maintenance_mode") {
      if (typeof value?.enabled !== "boolean" || typeof value?.message !== "string" || !value.message.trim()) {
        return NextResponse.json({ message: "Provide enabled (true/false) and a message." }, { status: 400 })
      }
    } else if (key === "login_banner") {
      // Unlike maintenance mode, a login banner may be saved disabled with an
      // empty message (e.g. clearing it) - a message is only required while
      // turning it on. attachments defaults to [] for older callers that
      // don't send it (e.g. the "Turn off" action, which only ever flips
      // enabled - the caller is expected to pass through whatever
      // attachments it already had, same as it does with message).
      if (typeof value?.enabled !== "boolean" || typeof value?.message !== "string") {
        return NextResponse.json({ message: "Provide enabled (true/false) and a message." }, { status: 400 })
      }
      if (!Array.isArray(value.attachments)) value.attachments = []
      if (value.enabled && !value.message.trim()) {
        return NextResponse.json({ message: "Enter a message to show, or turn the banner off." }, { status: 400 })
      }
    } else if (key === "badge_thresholds") {
      const err = validateBadgeThresholds(value)
      if (err) return NextResponse.json({ message: err }, { status: 400 })
    } else {
      const min = Number(value?.min)
      const max = value?.max === null || value?.max === undefined || value?.max === "" ? null : Number(value.max)
      if (!Number.isFinite(min) || min < 0) return NextResponse.json({ message: "Minimum must be zero or more." }, { status: 400 })
      if (max !== null && (!Number.isFinite(max) || max < min)) return NextResponse.json({ message: "Maximum must be a number at least as large as the minimum, or left blank for no maximum." }, { status: 400 })
      value.min = min
      value.max = max
    }

    const { error } = await supabase
      .from("platform_settings")
      .update({ value, updated_at: new Date().toISOString(), updated_by: auth.user.id })
      .eq("key", key)
    if (error) return NextResponse.json({ message: error.message }, { status: 400 })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Admin settings update error:", error)
    return NextResponse.json({ message: "Could not save this setting." }, { status: 503 })
  }
}
