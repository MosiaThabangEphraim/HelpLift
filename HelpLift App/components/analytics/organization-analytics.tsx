"use client"

import { useMemo, useState } from "react"
import { Download } from "lucide-react"
import { formatCurrency } from "@/lib/banking"
import { downloadCsv, toCsv } from "@/lib/csv"
import {
  bucketByMonth, byStatusOrder, countBy, firstOf, inRange, percent, rangeStart, sumBy, topN,
  type AnalyticsRange, type MonthPoint,
} from "@/lib/analytics"
import { ChartCard, MonthlyColumns, RangeFilter, RankedBars, StatTile, VizRoot } from "@/components/analytics/chart-parts"

type Person = { name: string; email?: string | null }
type NeedRef = { title: string }
type Props = {
  needs: {
    title?: string; status: string; category: string; created_at: string
    urgency?: string; location?: string | null; target_amount?: number | null; due_date?: string | null
  }[]
  donations: {
    amount: number; status: string; created_at: string
    payment_method?: string; reference_code?: string
    needs?: NeedRef[] | NeedRef | null
    givers?: Person[] | Person | null
  }[]
  interests: {
    status: string; created_at: string; message?: string | null
    needs?: NeedRef[] | NeedRef | null
    givers?: Person[] | Person | null
  }[]
  fulfillments: {
    status: string; created_at: string; completed_at?: string | null
    givers?: Person[] | Person | null
    support_interests?: { needs?: NeedRef[] | NeedRef | null }[] | { needs?: NeedRef[] | NeedRef | null } | null
  }[]
}

function ExportButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 dark:border-[#233350] px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#1A2740]"
    >
      <Download className="w-3.5 h-3.5" /> Export {label}
    </button>
  )
}

const day = (value: string | null | undefined) => (value ? new Date(value).toISOString().slice(0, 10) : "")

const NEED_STATUSES = [
  { key: "draft", label: "Awaiting approval" },
  { key: "open", label: "Open" },
  { key: "in_progress", label: "In progress" },
  { key: "fulfilled", label: "Fulfilled" },
  { key: "closed", label: "Closed" },
  { key: "rejected", label: "Rejected" },
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

function peakNote(points: MonthPoint[], format: (value: number) => string, noun: string) {
  const best = points.reduce((max, point) => (point.value > max.value ? point : max), points[0] || { key: "", label: "", value: 0 })
  return best && best.value > 0 ? `Best month: ${best.label} (${format(best.value)} ${noun})`.replace(" )", ")") : undefined
}

// Analytics for an organization: money received, offers of support, needs and
// deliveries. Computed from data the dashboard has already loaded.
export function OrganizationAnalytics({ needs, donations, interests, fulfillments }: Props) {
  const [range, setRange] = useState<AnalyticsRange>(12)

  const view = useMemo(() => {
    const start = rangeStart(range)
    const successful = donations.filter(d => d.status === "successful" && inRange(d.created_at, start))
    const awaiting = donations.filter(d => d.status === "pending" && inRange(d.created_at, start))
    const offers = interests.filter(i => inRange(i.created_at, start))
    const deliveries = fulfillments.filter(f => inRange(f.created_at, start))
    const periodNeeds = needs.filter(n => inRange(n.created_at, start))

    const funds = successful.reduce((total, d) => total + Number(d.amount || 0), 0)
    const acceptedOffers = offers.filter(i => i.status === "accepted").length
    const started = deliveries.filter(f => f.status !== "cancelled")
    const completed = deliveries.filter(f => f.status === "completed").length

    return {
      funds,
      successfulCount: successful.length,
      awaitingCount: awaiting.length,
      offersCount: offers.length,
      acceptedShare: percent(acceptedOffers, offers.length),
      completed,
      completionRate: percent(completed, started.length),
      openNeeds: needs.filter(n => n.status === "open" || n.status === "in_progress").length,
      createdNeeds: periodNeeds.length,
      fundsByMonth: bucketByMonth(successful, d => d.created_at, d => Number(d.amount || 0), range),
      offersByMonth: bucketByMonth(offers, i => i.created_at, () => 1, range),
      needsByStatus: byStatusOrder(countBy(periodNeeds, n => n.status), NEED_STATUSES),
      deliveriesByStatus: byStatusOrder(countBy(deliveries, f => f.status), DELIVERY_STATUSES),
      topNeeds: topN(sumBy(successful, d => firstOf(d.needs)?.title || null, d => Number(d.amount || 0)), 5),
    }
  }, [needs, donations, interests, fulfillments, range])

  const nothingAtAll = needs.length + donations.length + interests.length + fulfillments.length === 0

  // --- CSV exports: same data as the charts, for the chosen time range ---
  const stamp = new Date().toISOString().slice(0, 10)
  const rangeName = range === "all" ? "all-time" : `last-${range}-months`
  const start = rangeStart(range)
  const person = (value: Person[] | Person | null | undefined) => firstOf(value)

  const exportSummary = () =>
    downloadCsv(`helplift-summary-${rangeName}-${stamp}.csv`, toCsv(
      [
        { metric: "Period", value: RANGE_LABEL[String(range)] },
        { metric: "Funds received (confirmed donations, ZAR)", value: view.funds.toFixed(2) },
        { metric: "Confirmed donations", value: view.successfulCount },
        { metric: "Donations awaiting verification", value: view.awaitingCount },
        { metric: "Offers of support", value: view.offersCount },
        { metric: "Offers accepted (%)", value: view.acceptedShare ?? "" },
        { metric: "Deliveries completed", value: view.completed },
        { metric: "Deliveries completed (% of started)", value: view.completionRate ?? "" },
        { metric: "Open needs right now", value: view.openNeeds },
        { metric: "Needs created in this period", value: view.createdNeeds },
      ],
      [{ header: "Metric", value: r => r.metric }, { header: "Value", value: r => r.value }]
    ))

  const exportTrends = () => {
    const offersByKey = new Map(view.offersByMonth.map(point => [point.key, point.value]))
    downloadCsv(`helplift-monthly-trends-${rangeName}-${stamp}.csv`, toCsv(view.fundsByMonth, [
      { header: "Month", value: p => p.label },
      { header: "Funds received (ZAR)", value: p => p.value.toFixed(2) },
      { header: "Offers of support", value: p => offersByKey.get(p.key) ?? 0 },
    ]))
  }

  const exportNeeds = () =>
    downloadCsv(`helplift-needs-${rangeName}-${stamp}.csv`, toCsv(needs.filter(n => inRange(n.created_at, start)), [
      { header: "Title", value: n => n.title },
      { header: "Category", value: n => n.category },
      { header: "Status", value: n => n.status },
      { header: "Urgency", value: n => n.urgency },
      { header: "Location", value: n => n.location },
      { header: "Target amount (ZAR)", value: n => n.target_amount },
      { header: "Due date", value: n => day(n.due_date) },
      { header: "Created", value: n => day(n.created_at) },
    ]))

  const exportDonations = () =>
    downloadCsv(`helplift-donations-${rangeName}-${stamp}.csv`, toCsv(donations.filter(d => inRange(d.created_at, start)), [
      { header: "Date", value: d => day(d.created_at) },
      { header: "Amount (ZAR)", value: d => Number(d.amount || 0).toFixed(2) },
      { header: "Status", value: d => d.status },
      { header: "Payment method", value: d => d.payment_method },
      { header: "Reference", value: d => d.reference_code },
      { header: "Need", value: d => firstOf(d.needs)?.title },
      { header: "Donor", value: d => person(d.givers)?.name },
    ]))

  const exportOffers = () =>
    downloadCsv(`helplift-offers-of-support-${rangeName}-${stamp}.csv`, toCsv(interests.filter(i => inRange(i.created_at, start)), [
      { header: "Date", value: i => day(i.created_at) },
      { header: "Status", value: i => i.status },
      { header: "Need", value: i => firstOf(i.needs)?.title },
      { header: "Giver", value: i => person(i.givers)?.name },
      { header: "Giver email", value: i => person(i.givers)?.email },
      { header: "Message", value: i => i.message },
    ]))

  const exportDeliveries = () =>
    downloadCsv(`helplift-deliveries-${rangeName}-${stamp}.csv`, toCsv(fulfillments.filter(f => inRange(f.created_at, start)), [
      { header: "Started", value: f => day(f.created_at) },
      { header: "Status", value: f => f.status },
      { header: "Need", value: f => firstOf(firstOf(f.support_interests)?.needs)?.title },
      { header: "Giver", value: f => person(f.givers)?.name },
      { header: "Completed", value: f => day(f.completed_at) },
    ]))

  return (
    <VizRoot>
      <RangeFilter value={range} onChange={setRange} />

      {nothingAtAll && (
        <p className="rounded-2xl border border-dashed border-slate-300 dark:border-[#233350] p-6 text-center text-sm text-slate-500 dark:text-slate-400">
          Your analytics will appear here once you have needs, donations or offers of support.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <StatTile label="Funds received" value={money(view.funds)} note={view.awaitingCount ? `${view.awaitingCount} awaiting verification` : "Confirmed donations"} />
        <StatTile label="Donations" value={String(view.successfulCount)} note="Confirmed by an administrator" />
        <StatTile label="Offers of support" value={String(view.offersCount)} note={view.acceptedShare === null ? "None yet" : `${view.acceptedShare}% accepted`} />
        <StatTile label="Deliveries completed" value={String(view.completed)} note={view.completionRate === null ? "None started yet" : `${view.completionRate}% of started`} />
        <StatTile label="Open needs" value={String(view.openNeeds)} note={`${view.createdNeeds} created in this period`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Funds received"
          description={peakNote(view.fundsByMonth, money, "") || "Confirmed donations per month"}
          isEmpty={view.successfulCount === 0}
          emptyText="No confirmed donations in this period."
          rows={view.fundsByMonth.map(p => ({ label: p.label, value: money(p.value) }))}
          valueHeading="Amount"
        >
          <MonthlyColumns data={view.fundsByMonth} seriesLabel="Funds received" format={money} />
        </ChartCard>

        <ChartCard
          title="Offers of support"
          description={peakNote(view.offersByMonth, whole, "offers") || "Givers offering to help, per month"}
          isEmpty={view.offersCount === 0}
          emptyText="No offers of support in this period."
          rows={view.offersByMonth.map(p => ({ label: p.label, value: String(p.value) }))}
          valueHeading="Offers"
        >
          <MonthlyColumns data={view.offersByMonth} seriesLabel="Offers of support" format={whole} />
        </ChartCard>

        <ChartCard
          title="Top needs by funds"
          description="Confirmed donations, largest first (top 5)"
          isEmpty={view.topNeeds.length === 0}
          emptyText="No confirmed donations to specific needs yet."
          rows={view.topNeeds.map(p => ({ label: p.name, value: money(p.value) }))}
          valueHeading="Amount"
        >
          <RankedBars data={view.topNeeds} seriesLabel="Funds" format={money} />
        </ChartCard>

        <ChartCard
          title="Needs by status"
          description="Where the needs created in this period stand"
          isEmpty={view.createdNeeds === 0}
          emptyText="No needs created in this period."
          rows={view.needsByStatus.map(p => ({ label: p.name, value: String(p.value) }))}
          valueHeading="Needs"
        >
          <RankedBars data={view.needsByStatus} seriesLabel="Needs" format={whole} />
        </ChartCard>

        <ChartCard
          title="Deliveries by status"
          description="Progress of accepted offers"
          isEmpty={view.deliveriesByStatus.every(p => p.value === 0)}
          emptyText="No deliveries in this period."
          rows={view.deliveriesByStatus.map(p => ({ label: p.name, value: String(p.value) }))}
          valueHeading="Deliveries"
        >
          <RankedBars data={view.deliveriesByStatus} seriesLabel="Deliveries" format={whole} />
        </ChartCard>
      </div>

      <section className="rounded-3xl border border-slate-200 dark:border-[#233350] bg-white dark:bg-[#121B2E] p-5 space-y-3">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Export your data (CSV)</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Downloads open in Excel or Google Sheets and cover the time range chosen above ({RANGE_LABEL[String(range)]}).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ExportButton label="summary" onClick={exportSummary} />
          <ExportButton label="monthly trends" onClick={exportTrends} />
          <ExportButton label="needs" onClick={exportNeeds} />
          <ExportButton label="donations" onClick={exportDonations} />
          <ExportButton label="offers of support" onClick={exportOffers} />
          <ExportButton label="deliveries" onClick={exportDeliveries} />
        </div>
      </section>
    </VizRoot>
  )
}
