"use client"

import { useMemo, useState } from "react"
import { Download } from "lucide-react"
import { formatCurrency } from "@/lib/banking"
import { downloadCsv, toCsv } from "@/lib/csv"
import {
  bucketByMonth, byStatusOrder, countBy, firstOf, inRange, resolveRange, sumBy, topN,
  type AnalyticsRange, type MonthPoint,
} from "@/lib/analytics"
import { ChartCard, DateRangeFilter, MonthlyArea, MonthlyLine, RangeFilter, RankedBars, StatTile, StatusPie, VizRoot } from "@/components/analytics/chart-parts"

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
    completed_at?: string | null
    support_interests?: { needs?: (Named)[] | Named | null }[] | { needs?: (Named)[] | Named | null } | null
  }[]
  gifts: { status: string; created_at: string }[]
}

function ExportButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded border border-slate-200 dark:border-[#233350] px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#1A2740]"
    >
      <Download className="w-3.5 h-3.5" /> Export {label}
    </button>
  )
}

const day = (value: string | null | undefined) => (value ? new Date(value).toISOString().slice(0, 10) : "")

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
const RANGE_LABEL: Record<string, string> = { "6": "last 6 months", "12": "last 12 months", all: "all time" }
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
  // An explicit date picked here always overrides the matching side of the
  // quick preset above - see resolveRange in lib/analytics.ts.
  const [customFrom, setCustomFrom] = useState("")
  const [customTo, setCustomTo] = useState("")
  const bounds = useMemo(() => resolveRange(range, customFrom, customTo), [range, customFrom, customTo])

  const view = useMemo(() => {
    const successful = donations.filter(d => d.status === "successful" && inRange(d.created_at, bounds))
    const awaiting = donations.filter(d => d.status === "pending" && inRange(d.created_at, bounds))
    const offers = interests.filter(i => inRange(i.created_at, bounds))
    const deliveries = fulfillments.filter(f => inRange(f.created_at, bounds))
    const pledges = gifts.filter(g => inRange(g.created_at, bounds))

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
      approvedPledges: pledges.filter(g => g.status === "approved" || g.status === "claimed").length,
      offersCount: offers.length,
      givingByMonth: bucketByMonth(successful, d => d.created_at, d => Number(d.amount || 0), bounds),
      offersByMonth: bucketByMonth(offers, i => i.created_at, () => 1, bounds),
      byOrganization: topN(sumBy(successful, orgOf, d => Number(d.amount || 0)), 5),
      offersByStatus: byStatusOrder(countBy(offers, i => i.status), OFFER_STATUSES),
      deliveriesByStatus: byStatusOrder(countBy(deliveries, f => f.status), DELIVERY_STATUSES),
      byCause: topN(countBy(deliveries.filter(f => f.status !== "cancelled"), f => deliveryNeed(f)?.category || null), 5),
    }
  }, [donations, interests, fulfillments, gifts, bounds])

  const nothingAtAll = donations.length + interests.length + fulfillments.length + gifts.length === 0

  // --- CSV exports: same data as the charts, for the chosen time range ---
  const stamp = new Date().toISOString().slice(0, 10)
  const rangeName = customFrom || customTo ? `${customFrom || "start"}-to-${customTo || "now"}` : range === "all" ? "all-time" : `last-${range}-months`
  const rangeLabel = customFrom || customTo ? `${customFrom || "the start"} to ${customTo || "now"}` : RANGE_LABEL[String(range)]

  const exportSummary = () =>
    downloadCsv(`helplift-summary-${rangeName}-${stamp}.csv`, toCsv(
      [
        { metric: "Period", value: rangeLabel },
        { metric: "Total donated (confirmed, ZAR)", value: view.funds.toFixed(2) },
        { metric: "Donations made", value: view.successfulCount },
        { metric: "Donations awaiting verification", value: view.awaitingCount },
        { metric: "Needs supported", value: view.supportedNeeds },
        { metric: "Organizations helped", value: view.helpedOrgs },
        { metric: "Deliveries completed", value: view.completed },
        { metric: "Offers of help", value: view.offersCount },
        { metric: "Gifts pledged", value: view.pledgeCount },
        { metric: "Gifts pledged approved", value: view.approvedPledges },
      ],
      [{ header: "Metric", value: r => r.metric }, { header: "Value", value: r => r.value }]
    ))

  const exportTrends = () => {
    const offersByKey = new Map(view.offersByMonth.map(point => [point.key, point.value]))
    downloadCsv(`helplift-monthly-trends-${rangeName}-${stamp}.csv`, toCsv(view.givingByMonth, [
      { header: "Month", value: p => p.label },
      { header: "Donated (ZAR)", value: p => p.value.toFixed(2) },
      { header: "Offers of help", value: p => offersByKey.get(p.key) ?? 0 },
    ]))
  }

  const exportDonations = () =>
    downloadCsv(`helplift-donations-${rangeName}-${stamp}.csv`, toCsv(donations.filter(d => inRange(d.created_at, bounds)), [
      { header: "Date", value: d => day(d.created_at) },
      { header: "Amount (ZAR)", value: d => Number(d.amount || 0).toFixed(2) },
      { header: "Status", value: d => d.status },
      { header: "Need", value: d => firstOf(d.needs)?.title },
      { header: "Organization", value: d => firstOf(firstOf(d.needs)?.organizations)?.name },
    ]))

  const exportOffers = () =>
    downloadCsv(`helplift-offers-of-help-${rangeName}-${stamp}.csv`, toCsv(interests.filter(i => inRange(i.created_at, bounds)), [
      { header: "Date", value: i => day(i.created_at) },
      { header: "Status", value: i => i.status },
      { header: "Need", value: i => firstOf(i.needs)?.title },
    ]))

  const exportDeliveries = () =>
    downloadCsv(`helplift-deliveries-${rangeName}-${stamp}.csv`, toCsv(fulfillments.filter(f => inRange(f.created_at, bounds)), [
      { header: "Started", value: f => day(f.created_at) },
      { header: "Status", value: f => f.status },
      { header: "Need", value: f => firstOf(firstOf(f.support_interests)?.needs)?.title },
      { header: "Organization", value: f => firstOf(firstOf(firstOf(f.support_interests)?.needs)?.organizations)?.name },
      { header: "Completed", value: f => day(f.completed_at) },
    ]))

  const exportGifts = () =>
    downloadCsv(`helplift-gift-pledges-${rangeName}-${stamp}.csv`, toCsv(gifts.filter(g => inRange(g.created_at, bounds)), [
      { header: "Pledged", value: g => day(g.created_at) },
      { header: "Status", value: g => g.status },
    ]))

  return (
    <VizRoot>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <RangeFilter value={range} onChange={setRange} />
        <DateRangeFilter from={customFrom} to={customTo} onFromChange={setCustomFrom} onToChange={setCustomTo} />
      </div>

      {nothingAtAll && (
        <p className="rounded border border-dashed border-slate-300 dark:border-[#233350] p-6 text-center text-sm text-slate-500 dark:text-slate-400">
          Your giving analytics will appear here once you donate, offer help or pledge a gift.
        </p>
      )}

      <div className="grid grid-cols-2 gap-x-6 gap-y-5 md:grid-cols-3 xl:grid-cols-6">
        <StatTile label="Total donated" value={view.funds} prefix="R" decimals={2} note={view.awaitingCount ? `${view.awaitingCount} awaiting verification` : "Confirmed donations"} />
        <StatTile label="Donations made" value={view.successfulCount} note="Confirmed by an administrator" />
        <StatTile label="Needs supported" value={view.supportedNeeds} note="Donated to or offered help with" />
        <StatTile label="Organizations helped" value={view.helpedOrgs} />
        <StatTile label="Deliveries completed" value={view.completed} note="Support you delivered" />
        <StatTile label="Gifts pledged" value={view.pledgeCount} note={`${view.approvedPledges} approved`} />
      </div>

      <div className="grid gap-x-10 gap-y-8 lg:grid-cols-2">
        <ChartCard
          title="Your giving over time"
          description={peakNote(view.givingByMonth, money) || "Confirmed donations per month"}
          isEmpty={view.successfulCount === 0}
          emptyText="No confirmed donations in this period."
          rows={view.givingByMonth.map(p => ({ label: p.label, value: money(p.value) }))}
          valueHeading="Amount"
        >
          <MonthlyArea data={view.givingByMonth} seriesLabel="Donated" format={money} />
        </ChartCard>

        <ChartCard
          title="Your offers over time"
          description={peakNote(view.offersByMonth, whole) || "Offers of help you made, per month"}
          isEmpty={view.offersCount === 0}
          emptyText="No offers of help in this period."
          rows={view.offersByMonth.map(p => ({ label: p.label, value: String(p.value) }))}
          valueHeading="Offers"
        >
          <MonthlyLine data={view.offersByMonth} seriesLabel="Offers" format={whole} />
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
          title="Causes you support"
          description="Your deliveries by need category (top 5)"
          isEmpty={view.byCause.length === 0}
          emptyText="No deliveries in this period."
          rows={view.byCause.map(p => ({ label: p.name, value: String(p.value) }))}
          valueHeading="Deliveries"
        >
          <RankedBars data={view.byCause} seriesLabel="Deliveries" format={whole} />
        </ChartCard>

        <ChartCard
          title="Your offers of help"
          description="How organizations responded"
          isEmpty={view.offersCount === 0}
          emptyText="No offers of help in this period."
          rows={view.offersByStatus.map(p => ({ label: p.name, value: String(p.value) }))}
          valueHeading="Offers"
        >
          <StatusPie data={view.offersByStatus} format={whole} />
        </ChartCard>

        <ChartCard
          title="Deliveries by status"
          description="Progress of your accepted offers"
          isEmpty={view.deliveriesByStatus.every(p => p.value === 0)}
          emptyText="No deliveries in this period."
          rows={view.deliveriesByStatus.map(p => ({ label: p.name, value: String(p.value) }))}
          valueHeading="Deliveries"
        >
          <StatusPie data={view.deliveriesByStatus} format={whole} />
        </ChartCard>
      </div>

      <section className="border-t border-slate-200 dark:border-[#233350] pt-4 space-y-3">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Export your data (CSV)</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Downloads open in Excel or Google Sheets and cover the time range chosen above ({rangeLabel}).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ExportButton label="summary" onClick={exportSummary} />
          <ExportButton label="monthly trends" onClick={exportTrends} />
          <ExportButton label="donations" onClick={exportDonations} />
          <ExportButton label="offers of help" onClick={exportOffers} />
          <ExportButton label="deliveries" onClick={exportDeliveries} />
          <ExportButton label="gift pledges" onClick={exportGifts} />
        </div>
      </section>
    </VizRoot>
  )
}
