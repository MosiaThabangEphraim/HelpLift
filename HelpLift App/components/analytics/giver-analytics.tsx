"use client"

import { useMemo, useState } from "react"
import { formatCurrency } from "@/lib/banking"
import {
  bucketByMonth, byStatusOrder, countBy, firstOf, inRange, rangeStart, sumBy, topN,
  type AnalyticsRange, type MonthPoint,
} from "@/lib/analytics"
import { ChartCard, MonthlyColumns, RangeFilter, RankedBars, StatTile, VizRoot } from "@/components/analytics/chart-parts"

type Named = { title?: string; category?: string; organizations?: { name: string }[] | { name: string } | null }

type Props = {
  donations: {
    amount: number
    status: string
    created_at: string
    needs?: (Named)[] | Named | null
    gift_offerings?: { title: string }[] | { title: string } | null
  }[]
  interests: { status: string; created_at?: string | null; needs?: { title: string }[] | { title: string } | null }[]
  fulfillments: {
    status: string
    created_at: string
    support_interests?: { needs?: (Named)[] | Named | null }[] | { needs?: (Named)[] | Named | null } | null
  }[]
  gifts: { status: string; created_at: string }[]
}

const OFFER_STATUSES = [
  { key: "pending", label: "Awaiting a reply" },
  { key: "accepted", label: "Accepted" },
  { key: "declined", label: "Declined" },
]
const DELIVERY_STATUSES = [
  { key: "pending", label: "Not started" },
  { key: "in_progress", label: "In progress" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
]
const money = (value: number) => formatCurrency(value)
const whole = (value: number) => String(Math.round(value))

function peakNote(points: MonthPoint[], format: (value: number) => string) {
  const best = points.reduce((max, point) => (point.value > max.value ? point : max), points[0] || { key: "", label: "", value: 0 })
  return best && best.value > 0 ? `Biggest month: ${best.label} (${format(best.value)})` : undefined
}

// Analytics for a giver: what they've given, where it went and how their offers
// of help are progressing. Computed from data the dashboard has already loaded.
export function GiverAnalytics({ donations, interests, fulfillments, gifts }: Props) {
  const [range, setRange] = useState<AnalyticsRange>(12)

  const view = useMemo(() => {
    const start = rangeStart(range)
    const successful = donations.filter(d => d.status === "successful" && inRange(d.created_at, start))
    const awaiting = donations.filter(d => d.status === "pending" && inRange(d.created_at, start))
    const offers = interests.filter(i => inRange(i.created_at, start))
    const deliveries = fulfillments.filter(f => inRange(f.created_at, start))
    const pledges = gifts.filter(g => inRange(g.created_at, start))

    const orgOf = (d: Props["donations"][number]) =>
      firstOf(firstOf(d.needs)?.organizations)?.name || (d.gift_offerings ? "Gift Library pledges" : null)
    const deliveryNeed = (f: Props["fulfillments"][number]) => firstOf(firstOf(f.support_interests)?.needs)
    const funds = successful.reduce((total, d) => total + Number(d.amount || 0), 0)

    const supportedNeeds = new Set<string>()
    for (const d of successful) { const t = firstOf(d.needs)?.title; if (t) supportedNeeds.add(t) }
    for (const i of offers) { const t = firstOf(i.needs)?.title; if (t) supportedNeeds.add(t) }
    for (const f of deliveries) { const t = deliveryNeed(f)?.title; if (t) supportedNeeds.add(t) }

    const helpedOrgs = new Set<string>()
    for (const d of successful) { const n = firstOf(firstOf(d.needs)?.organizations)?.name; if (n) helpedOrgs.add(n) }
    for (const f of deliveries) { const n = firstOf(deliveryNeed(f)?.organizations)?.name; if (n) helpedOrgs.add(n) }

    return {
      funds,
      successfulCount: successful.length,
      awaitingCount: awaiting.length,
      supportedNeeds: supportedNeeds.size,
      helpedOrgs: helpedOrgs.size,
      completed: deliveries.filter(f => f.status === "completed").length,
      pledgeCount: pledges.length,
      approvedPledges: pledges.filter(g => g.status === "approved" || g.status === "claimed" || g.status === "pending_claim").length,
      offersCount: offers.length,
      givingByMonth: bucketByMonth(successful, d => d.created_at, d => Number(d.amount || 0), range),
      byOrganization: topN(sumBy(successful, orgOf, d => Number(d.amount || 0)), 5),
      offersByStatus: byStatusOrder(countBy(offers, i => i.status), OFFER_STATUSES),
      deliveriesByStatus: byStatusOrder(countBy(deliveries, f => f.status), DELIVERY_STATUSES),
      byCause: topN(countBy(deliveries.filter(f => f.status !== "cancelled"), f => deliveryNeed(f)?.category || null), 5),
    }
  }, [donations, interests, fulfillments, gifts, range])

  const nothingAtAll = donations.length + interests.length + fulfillments.length + gifts.length === 0

  return (
    <VizRoot>
      <RangeFilter value={range} onChange={setRange} />

      {nothingAtAll && (
        <p className="rounded-2xl border border-dashed border-slate-300 dark:border-[#233350] p-6 text-center text-sm text-slate-500 dark:text-slate-400">
          Your giving analytics will appear here once you donate, offer help or pledge a gift.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatTile label="Total donated" value={money(view.funds)} note={view.awaitingCount ? `${view.awaitingCount} awaiting verification` : "Confirmed donations"} />
        <StatTile label="Donations made" value={String(view.successfulCount)} note="Confirmed by an administrator" />
        <StatTile label="Needs supported" value={String(view.supportedNeeds)} note="Donated to or offered help with" />
        <StatTile label="Organizations helped" value={String(view.helpedOrgs)} />
        <StatTile label="Deliveries completed" value={String(view.completed)} note="Support you delivered" />
        <StatTile label="Gifts pledged" value={String(view.pledgeCount)} note={`${view.approvedPledges} approved`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Your giving over time"
          description={peakNote(view.givingByMonth, money) || "Confirmed donations per month"}
          isEmpty={view.successfulCount === 0}
          emptyText="No confirmed donations in this period."
          rows={view.givingByMonth.map(p => ({ label: p.label, value: money(p.value) }))}
          valueHeading="Amount"
        >
          <MonthlyColumns data={view.givingByMonth} seriesLabel="Donated" format={money} />
        </ChartCard>

        <ChartCard
          title="Where your money went"
          description="Confirmed donations by organization (top 5)"
          isEmpty={view.byOrganization.length === 0}
          emptyText="No confirmed donations in this period."
          rows={view.byOrganization.map(p => ({ label: p.name, value: money(p.value) }))}
          valueHeading="Amount"
        >
          <RankedBars data={view.byOrganization} seriesLabel="Donated" format={money} />
        </ChartCard>

        <ChartCard
          title="Your offers of help"
          description="How organizations responded"
          isEmpty={view.offersCount === 0}
          emptyText="No offers of help in this period."
          rows={view.offersByStatus.map(p => ({ label: p.name, value: String(p.value) }))}
          valueHeading="Offers"
        >
          <RankedBars data={view.offersByStatus} seriesLabel="Offers" format={whole} />
        </ChartCard>

        <ChartCard
          title="Deliveries by status"
          description="Progress of your accepted offers"
          isEmpty={view.deliveriesByStatus.every(p => p.value === 0)}
          emptyText="No deliveries in this period."
          rows={view.deliveriesByStatus.map(p => ({ label: p.name, value: String(p.value) }))}
          valueHeading="Deliveries"
        >
          <RankedBars data={view.deliveriesByStatus} seriesLabel="Deliveries" format={whole} />
        </ChartCard>

        <ChartCard
          title="Causes you support"
          description="Your deliveries by need category (top 5)"
          isEmpty={view.byCause.length === 0}
          emptyText="No deliveries in this period."
          rows={view.byCause.map(p => ({ label: p.name, value: String(p.value) }))}
          valueHeading="Deliveries"
        >
          <RankedBars data={view.byCause} seriesLabel="Deliveries" format={whole} />
        </ChartCard>
      </div>
    </VizRoot>
  )
}
