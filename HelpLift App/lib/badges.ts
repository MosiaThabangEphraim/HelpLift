import type { SupabaseClient } from "@supabase/supabase-js"
import type { BadgeThresholds } from "@/lib/platform-settings"
import { firstOf } from "@/lib/utils"
import { createAdminClient } from "@/lib/supabase/admin"

// Motivational badges for givers and organizations - see
// 20260927000200_badges.sql for the ledger table these get diffed against
// (purely for notification dedup + "earned on" dates), and
// app/api/giver/badges/route.ts / app/api/organization/badges/route.ts for
// how these functions are actually called. Every badge here is computed
// fresh from existing tables each time - nothing about "what's earned" is
// itself stored.

export type BadgeUnit = "currency" | "count" | "percent" | "hours"

export type BadgeStatus = {
  key: string
  label: string
  description: string
  icon: string
  earned: boolean
  // Only present for a not-yet-earned badge with a single clear numeric
  // target worth showing progress toward (a milestone tier, a count...).
  // Binary badges (first donation, platform supporter) and dynamic/plural
  // ones (category champion) omit this - there's no one number to show.
  progressCurrent?: number
  progressTarget?: number
  unit?: BadgeUnit
  earnedAt?: string | null
}

function monthKey(dateStr: string) {
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

// Longest run of calendar-adjacent months in a set of (possibly repeated,
// possibly unsorted) month keys - used for the giver's donation streak.
function longestConsecutiveMonthRun(keys: string[]): number {
  const unique = Array.from(new Set(keys)).sort()
  if (unique.length === 0) return 0
  let best = 1
  let current = 1
  for (let i = 1; i < unique.length; i++) {
    const [py, pm] = unique[i - 1].split("-").map(Number)
    const [cy, cm] = unique[i].split("-").map(Number)
    const isNextMonth = (py === cy && cm === pm + 1) || (cy === py + 1 && pm === 12 && cm === 1)
    current = isNextMonth ? current + 1 : 1
    best = Math.max(best, current)
  }
  return best
}

function wholeYearsSince(dateStr: string): number {
  const then = new Date(dateStr)
  const now = new Date()
  let years = now.getFullYear() - then.getFullYear()
  const anniversaryThisYear = new Date(then)
  anniversaryThisYear.setFullYear(then.getFullYear() + years)
  if (anniversaryThisYear > now) years -= 1
  return Math.max(0, years)
}

function tierBadges(
  keyPrefix: string,
  total: number,
  amounts: { bronze: number; silver: number; gold: number },
  labelNoun: string,
  icon: string,
  unit: BadgeUnit,
  describeTarget: (n: number) => string
): BadgeStatus[] {
  const tiers: Array<{ tier: "bronze" | "silver" | "gold"; target: number }> = [
    { tier: "bronze", target: amounts.bronze },
    { tier: "silver", target: amounts.silver },
    { tier: "gold", target: amounts.gold },
  ]
  return tiers.map(({ tier, target }) => {
    const earned = total >= target
    const label = `${tier[0].toUpperCase()}${tier.slice(1)} ${labelNoun}`
    return {
      key: `${keyPrefix}_${tier}`,
      label,
      description: earned
        ? `Reached ${describeTarget(target)}.`
        : `Reach ${describeTarget(target)} to earn this badge.`,
      icon,
      earned,
      ...(earned ? {} : { progressCurrent: total, progressTarget: target, unit }),
    }
  })
}

// ------------------------------- Givers -------------------------------

type GiverInput = {
  giverId: string
  profileId: string
  accountCreatedAt: string
}

export async function computeGiverBadges(
  supabase: SupabaseClient,
  input: GiverInput,
  thresholds: BadgeThresholds["giver"]
): Promise<BadgeStatus[]> {
  const [{ data: ownDonations }, { data: platformDonations }, { data: giftRows }] = await Promise.all([
    // Need-based donations and Gift Library financial pledges - both use
    // giver_id (see 20260914002100_gift_claims_and_financial_pledges.sql).
    supabase
      .from("donations")
      .select("amount, created_at, need_id, needs(category, organization_id, status)")
      .eq("giver_id", input.giverId)
      .eq("status", "successful"),
    // "Support The Platform" donations made by a giver use donor_profile_id
    // instead (see 20260926000400_platform_donations.sql) - giver_id is null.
    supabase
      .from("donations")
      .select("amount, created_at")
      .eq("donor_profile_id", input.profileId)
      .eq("is_platform_donation", true)
      .eq("status", "successful"),
    // Gift Library goods/services they've posted that an organization claimed
    // (a "financial" gift_offering is a donation pledge, already counted
    // above once its donation resolves - this is specifically the non-money
    // Gift Library contribution).
    supabase
      .from("gift_offerings")
      .select("id")
      .eq("giver_id", input.giverId)
      .in("offering_type", ["goods", "services"])
      .eq("status", "claimed"),
  ])

  const ownRows = ownDonations || []
  const platformRows = platformDonations || []
  const totalAmount = [...ownRows, ...platformRows].reduce((sum, d: any) => sum + Number(d.amount || 0), 0)
  const allMonthKeys = [...ownRows, ...platformRows].map((d: any) => monthKey(d.created_at))

  const needsFulfilledIds = new Set<string>()
  const categoryCounts = new Map<string, number>()
  const orgIds = new Set<string>()
  for (const row of ownRows as any[]) {
    const need = firstOf(row.needs)
    if (need?.status === "fulfilled" && row.need_id) needsFulfilledIds.add(row.need_id)
    if (need?.category) categoryCounts.set(need.category, (categoryCounts.get(need.category) || 0) + 1)
    if (need?.organization_id) orgIds.add(need.organization_id)
  }

  const badges: BadgeStatus[] = []

  // --- Milestone tiers (total across every kind of successful donation) ---
  badges.push(
    ...tierBadges(
      "milestone",
      totalAmount,
      thresholds.milestoneAmounts,
      "Supporter",
      "medal",
      "currency",
      (n) => `R${n.toLocaleString()} donated in total`
    )
  )

  // --- First donation ---
  const hasAnyDonation = ownRows.length + platformRows.length > 0
  badges.push({
    key: "first_donation",
    label: "First Step",
    description: hasAnyDonation
      ? "Made your first successful donation."
      : "Make your first successful donation to earn this badge.",
    icon: "sparkle",
    earned: hasAnyDonation,
  })

  // --- Consistency / streak ---
  const streak = longestConsecutiveMonthRun(allMonthKeys)
  const streakEarned = streak >= thresholds.streakMonths
  badges.push({
    key: "streak",
    label: "Consistent Giver",
    description: streakEarned
      ? `Donated in ${thresholds.streakMonths}+ consecutive months.`
      : `Donate in ${thresholds.streakMonths} consecutive months to earn this badge.`,
    icon: "flame",
    earned: streakEarned,
    ...(streakEarned ? {} : { progressCurrent: streak, progressTarget: thresholds.streakMonths, unit: "count" }),
  })

  // --- Needs fulfilled ---
  const needsFulfilledEarned = needsFulfilledIds.size >= thresholds.needsFulfilledMin
  badges.push({
    key: "needs_fulfilled",
    label: "Needs Champion",
    description: needsFulfilledEarned
      ? `Supported ${thresholds.needsFulfilledMin}+ needs through to being fulfilled.`
      : `Support ${thresholds.needsFulfilledMin} needs through to being fulfilled to earn this badge.`,
    icon: "target",
    earned: needsFulfilledEarned,
    ...(needsFulfilledEarned ? {} : { progressCurrent: needsFulfilledIds.size, progressTarget: thresholds.needsFulfilledMin, unit: "count" }),
  })

  // --- Category champion (one per qualifying category - plural, dynamic) ---
  for (const [category, count] of categoryCounts) {
    if (count >= thresholds.categoryChampionMin) {
      badges.push({
        key: `category_champion_${category.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`,
        label: `${category} Champion`,
        description: `Donated to ${count} "${category}" needs.`,
        icon: "trophy",
        earned: true,
      })
    }
  }
  // A single motivational placeholder toward whichever category they're
  // closest to, if none qualify yet - avoids one locked card per category.
  if (![...categoryCounts.values()].some((c) => c >= thresholds.categoryChampionMin) && categoryCounts.size > 0) {
    const [closestCategory, closestCount] = [...categoryCounts.entries()].sort((a, b) => b[1] - a[1])[0]
    badges.push({
      key: "category_champion_next",
      label: "Category Champion",
      description: `Donate ${thresholds.categoryChampionMin - closestCount} more time(s) to "${closestCategory}" needs to earn its Champion badge.`,
      icon: "trophy",
      earned: false,
      progressCurrent: closestCount,
      progressTarget: thresholds.categoryChampionMin,
      unit: "count",
    })
  }

  // --- Well-rounded (spread across many categories) ---
  const wellRoundedEarned = categoryCounts.size >= thresholds.wellRoundedCategoriesMin
  badges.push({
    key: "well_rounded",
    label: "Well-Rounded Giver",
    description: wellRoundedEarned
      ? `Donated across ${thresholds.wellRoundedCategoriesMin}+ different categories.`
      : `Donate across ${thresholds.wellRoundedCategoriesMin} different categories to earn this badge.`,
    icon: "layers",
    earned: wellRoundedEarned,
    ...(wellRoundedEarned ? {} : { progressCurrent: categoryCounts.size, progressTarget: thresholds.wellRoundedCategoriesMin, unit: "count" }),
  })

  // --- Gift Library contributor (goods/services, not money) ---
  const giftCount = (giftRows || []).length
  const giftEarned = giftCount >= thresholds.giftLibraryContributorMin
  badges.push({
    key: "gift_library_contributor",
    label: "Gift Library Contributor",
    description: giftEarned
      ? `${thresholds.giftLibraryContributorMin}+ Gift Library offerings claimed by organizations.`
      : `Have ${thresholds.giftLibraryContributorMin} Gift Library offerings claimed by organizations to earn this badge.`,
    icon: "gift",
    earned: giftEarned,
    ...(giftEarned ? {} : { progressCurrent: giftCount, progressTarget: thresholds.giftLibraryContributorMin, unit: "count" }),
  })

  // --- Platform Supporter ---
  const platformEarned = platformRows.length >= thresholds.platformSupporterMin
  badges.push({
    key: "platform_supporter",
    label: "Platform Supporter",
    description: platformEarned
      ? "Supported HelpLift directly through \"Support The Platform\"."
      : "Make a \"Support The Platform\" donation to earn this badge.",
    icon: "heart",
    earned: platformEarned,
  })

  // --- Reach (distinct organizations supported) ---
  const reachEarned = orgIds.size >= thresholds.reachOrgsMin
  badges.push({
    key: "reach",
    label: "Community Connector",
    description: reachEarned
      ? `Supported ${thresholds.reachOrgsMin}+ different organizations.`
      : `Support ${thresholds.reachOrgsMin} different organizations to earn this badge.`,
    icon: "globe",
    earned: reachEarned,
    ...(reachEarned ? {} : { progressCurrent: orgIds.size, progressTarget: thresholds.reachOrgsMin, unit: "count" }),
  })

  // --- Anniversary ---
  const years = wholeYearsSince(input.accountCreatedAt)
  if (years >= 1) {
    badges.push({
      key: `anniversary_${years}`,
      label: years === 1 ? "1 Year on HelpLift" : `${years} Years on HelpLift`,
      description: `Member for ${years} year${years === 1 ? "" : "s"}.`,
      icon: "calendar",
      earned: true,
    })
  } else {
    const joined = new Date(input.accountCreatedAt)
    const nextAnniversary = new Date(joined)
    nextAnniversary.setFullYear(joined.getFullYear() + 1)
    const daysLeft = Math.max(0, Math.ceil((nextAnniversary.getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
    badges.push({
      key: "anniversary_next",
      label: "1 Year on HelpLift",
      description: `${daysLeft} day(s) until your first HelpLift anniversary.`,
      icon: "calendar",
      earned: false,
    })
  }

  return badges
}

// ---------------------------- Organizations ----------------------------

type OrganizationInput = {
  organizationId: string
}

export async function computeOrganizationBadges(
  supabase: SupabaseClient,
  input: OrganizationInput,
  thresholds: BadgeThresholds["organization"]
): Promise<BadgeStatus[]> {
  const [
    { data: needsRows },
    { data: donationRows },
    { data: storyRows },
    { data: fulfillmentRows },
    { data: orgRow },
  ] = await Promise.all([
    supabase.from("needs").select("id, status").eq("organization_id", input.organizationId),
    supabase.from("donations").select("amount").eq("organization_id", input.organizationId).eq("status", "successful"),
    supabase.from("impact_stories").select("id").eq("organization_id", input.organizationId).eq("status", "approved"),
    supabase
      .from("fulfillments")
      .select("status, created_at, support_interests(created_at)")
      .eq("organization_id", input.organizationId),
    supabase.from("organizations").select("created_at").eq("id", input.organizationId).single(),
  ])
  // Best available "verified since" date: the earliest approval recorded in
  // the audit trail, falling back to the organization's own signup date for
  // one approved before that history existed (or for a team member whose
  // session can't read another org's history - RLS-safe either way).
  let verifiedSince: string | null = orgRow?.created_at || null
  try {
    const { data: historyRows } = await supabase
      .from("organization_verification_history")
      .select("created_at")
      .eq("organization_id", input.organizationId)
      .eq("new_status", "approved")
      .order("created_at", { ascending: true })
      .limit(1)
    if (historyRows && historyRows[0]) verifiedSince = historyRows[0].created_at
  } catch {
    // Fall back to organizations.created_at above.
  }

  const badges: BadgeStatus[] = []

  const needsFulfilledCount = (needsRows || []).filter((n: any) => n.status === "fulfilled").length
  badges.push(
    ...tierBadges(
      "needs_fulfilled",
      needsFulfilledCount,
      thresholds.needsFulfilledAmounts,
      "Changemaker",
      "target",
      "count",
      (n) => `${n} needs fulfilled`
    )
  )

  const fundsRaised = (donationRows || []).reduce((sum: number, d: any) => sum + Number(d.amount || 0), 0)
  badges.push(
    ...tierBadges(
      "funds_raised",
      fundsRaised,
      thresholds.fundsRaisedAmounts,
      "Fundraiser",
      "banknote",
      "currency",
      (n) => `R${n.toLocaleString()} raised`
    )
  )

  const storyCount = (storyRows || []).length
  const storytellerEarned = storyCount >= thresholds.storytellerMin
  badges.push({
    key: "storyteller",
    label: "Storyteller",
    description: storytellerEarned
      ? `Published ${thresholds.storytellerMin}+ approved impact stories.`
      : `Publish ${thresholds.storytellerMin} approved impact stories to earn this badge.`,
    icon: "book-open",
    earned: storytellerEarned,
    ...(storytellerEarned ? {} : { progressCurrent: storyCount, progressTarget: thresholds.storytellerMin, unit: "count" }),
  })

  // --- Reliability: completed vs. total fulfillments, min sample size ---
  const fulfillments = fulfillmentRows || []
  const completedCount = fulfillments.filter((f: any) => f.status === "completed").length
  const reliabilityRate = fulfillments.length > 0 ? (completedCount / fulfillments.length) * 100 : 0
  const reliabilityEarned = fulfillments.length >= thresholds.reliabilityMinSample && reliabilityRate >= thresholds.reliabilityMinRate
  badges.push({
    key: "reliability",
    label: "Reliable Partner",
    description: reliabilityEarned
      ? `${Math.round(reliabilityRate)}% of accepted fulfillments completed.`
      : `Complete ${thresholds.reliabilityMinRate}%+ of at least ${thresholds.reliabilityMinSample} accepted fulfillments to earn this badge.`,
    icon: "shield-check",
    earned: reliabilityEarned,
    ...(reliabilityEarned
      ? {}
      : { progressCurrent: Math.round(reliabilityRate), progressTarget: thresholds.reliabilityMinRate, unit: "percent" }),
  })

  // --- Responsiveness: average time from interest to acceptance ---
  const responseHours: number[] = []
  for (const f of fulfillments as any[]) {
    const interest = firstOf(f.support_interests)
    if (!interest?.created_at || !f.created_at) continue
    const hours = (new Date(f.created_at).getTime() - new Date(interest.created_at).getTime()) / (60 * 60 * 1000)
    if (hours >= 0) responseHours.push(hours)
  }
  const avgResponseHours = responseHours.length > 0 ? responseHours.reduce((a, b) => a + b, 0) / responseHours.length : null
  const responsivenessEarned =
    responseHours.length >= thresholds.responsivenessMinSample &&
    avgResponseHours !== null &&
    avgResponseHours <= thresholds.responsivenessMaxHours
  badges.push({
    key: "responsiveness",
    label: "Fast Responder",
    description: responsivenessEarned
      ? `Averaging under ${thresholds.responsivenessMaxHours}h to act on interest from givers.`
      : `Average under ${thresholds.responsivenessMaxHours}h to act on interest from givers (at least ${thresholds.responsivenessMinSample} responses) to earn this badge.`,
    icon: "zap",
    earned: responsivenessEarned,
    ...(responsivenessEarned || avgResponseHours === null
      ? {}
      : { progressCurrent: Math.round(avgResponseHours), progressTarget: thresholds.responsivenessMaxHours, unit: "hours" }),
  })

  // --- Longevity ---
  if (verifiedSince) {
    const years = wholeYearsSince(verifiedSince)
    if (years >= 1) {
      badges.push({
        key: `longevity_${years}`,
        label: years === 1 ? "1 Year Verified" : `${years} Years Verified`,
        description: `Verified on HelpLift for ${years} year${years === 1 ? "" : "s"}.`,
        icon: "calendar",
        earned: true,
      })
    } else {
      const since = new Date(verifiedSince)
      const nextAnniversary = new Date(since)
      nextAnniversary.setFullYear(since.getFullYear() + 1)
      const daysLeft = Math.max(0, Math.ceil((nextAnniversary.getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
      badges.push({
        key: "longevity_next",
        label: "1 Year Verified",
        description: `${daysLeft} day(s) until your first anniversary as a verified organization.`,
        icon: "calendar",
        earned: false,
      })
    }
  }

  return badges
}

// ------------------------ Ledger sync + notify ------------------------

// Diffs a freshly-computed badge list against badge_awards, records any
// badge earned for the first time (service-role - bypasses RLS, same trust
// pattern as donation_proofs), and sends the "you earned a badge!"
// notification for each (the existing notification-created webhook emails
// it too - see app/api/webhooks/notification-created/route.ts - no separate
// email code needed here).
//
// A badge, once recorded, is a permanent trophy: if an admin later raises a
// threshold, that only changes who earns it from then on - it never revokes
// what someone already has, even though the badge is otherwise recomputed
// fresh every time. progress fields are stripped once a badge counts as
// earned, since there's nothing left to show progress toward.
export async function syncBadgeAwards(
  subjectType: "giver" | "organization",
  subjectId: string,
  recipientProfileId: string,
  computed: BadgeStatus[]
): Promise<BadgeStatus[]> {
  const admin = createAdminClient()
  const { data: existingRows } = await admin
    .from("badge_awards")
    .select("badge_key, earned_at")
    .eq("subject_type", subjectType)
    .eq("subject_id", subjectId)
  const earnedAtByKey = new Map<string, string>((existingRows || []).map((r: any) => [r.badge_key, r.earned_at]))

  const newlyEarned = computed.filter((b) => b.earned && !earnedAtByKey.has(b.key))
  if (newlyEarned.length > 0) {
    const nowIso = new Date().toISOString()
    try {
      await admin.from("badge_awards").upsert(
        newlyEarned.map((b) => ({ subject_type: subjectType, subject_id: subjectId, badge_key: b.key, earned_at: nowIso })),
        { onConflict: "subject_type,subject_id,badge_key", ignoreDuplicates: true }
      )
      await admin.from("notifications").insert(
        newlyEarned.map((b) => ({
          recipient_id: recipientProfileId,
          type: "badge_earned",
          title: `New badge: ${b.label}`,
          message: `You've earned the "${b.label}" badge on HelpLift - ${b.description}`,
        }))
      )
    } catch (e) {
      console.warn("Badge award/notification warning:", e)
    }
    for (const b of newlyEarned) if (!earnedAtByKey.has(b.key)) earnedAtByKey.set(b.key, nowIso)
  }

  return computed.map((b) => {
    const earnedAt = earnedAtByKey.get(b.key)
    if (earnedAt) {
      const { progressCurrent, progressTarget, unit, ...rest } = b
      return { ...rest, earned: true, earnedAt }
    }
    return { ...b, earned: false, earnedAt: null }
  })
}
