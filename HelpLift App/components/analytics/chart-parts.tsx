"use client"

import { useRef, useState } from "react"
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, LabelList, Line, LineChart, Pie, PieChart, XAxis, YAxis } from "recharts"
import { Download } from "lucide-react"
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { RANGE_OPTIONS, compactNumber, type AnalyticsRange, type MonthPoint, type RankedPoint } from "@/lib/analytics"
import { downloadChartAsImage } from "@/lib/chart-export"
import { CountUp } from "@/components/count-up"

// Chart colors are defined once, as roles, so light/dark swap in one place. The
// series color is the validated blue (slot 1): #2a78d6 on light cards, #3987e5
// on dark, both passing the lightness, chroma and 3:1 contrast checks against
// the actual card backgrounds. Every chart here plots a single series, so one
// hue is enough; identity comes from the labels, not from color.
const VIZ_CSS = `
.viz-root {
  --viz-series: #2a78d6;
  --viz-grid: #e1e0d9;
  --viz-axis: #c3c2b7;
  --viz-muted: #898781;
  --viz-text: #52514e;
}
.dark .viz-root {
  --viz-series: #3987e5;
  --viz-grid: #2c2c2a;
  --viz-axis: #383835;
  --viz-muted: #898781;
  --viz-text: #c3c2b7;
}
`

export function VizRoot({ children }: { children: React.ReactNode }) {
  return (
    <div className="viz-root space-y-6">
      <style>{VIZ_CSS}</style>
      {children}
    </div>
  )
}

// One filter row above everything it scopes.
export function RangeFilter({ value, onChange }: { value: AnalyticsRange; onChange: (range: AnalyticsRange) => void }) {
  return (
    <div className="flex items-center gap-2 flex-wrap" role="group" aria-label="Time range">
      <span className="text-xs font-bold uppercase tracking-wider text-slate-400 mr-1">Showing</span>
      {RANGE_OPTIONS.map(option => (
        <button
          key={String(option.value)}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors ${
            value === option.value
              ? "bg-blue-600 text-white"
              : "bg-slate-100 dark:bg-[#1A2740] text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-[#233350]"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

// An explicit "From"/"To" override, alongside the quick presets above - for
// picking a specific past window (e.g. a particular month or quarter)
// rather than only "the last N months". Either field can be set on its own;
// see resolveRange in lib/analytics.ts for exactly how the two combine.
export function DateRangeFilter({
  from,
  to,
  onFromChange,
  onToChange,
}: {
  from: string
  to: string
  onFromChange: (value: string) => void
  onToChange: (value: string) => void
}) {
  const inputClass = "rounded-xl border border-slate-200 dark:border-[#233350] bg-white dark:bg-[#0B1220] px-3 py-1.5 text-xs font-semibold"
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400">
        From
        <input type="date" value={from} onChange={e => onFromChange(e.target.value)} className={inputClass} />
      </label>
      <label className="flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400">
        To
        <input type="date" value={to} onChange={e => onToChange(e.target.value)} className={inputClass} />
      </label>
      {(from || to) && (
        <button
          type="button"
          onClick={() => { onFromChange(""); onToChange("") }}
          className="text-xs font-bold text-blue-600 hover:underline"
        >
          Clear dates
        </button>
      )}
    </div>
  )
}

// A single headline number. The number is the chart: no plot for one value.
export function StatTile({
  label,
  value,
  note,
  prefix = "",
  decimals = 0,
}: {
  label: string
  /** A number animates in with CountUp; a string (an already-formatted value, or a loading placeholder like "-") renders as-is. */
  value: string | number
  note?: string
  prefix?: string
  decimals?: number
}) {
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-[#233350] bg-white dark:bg-[#121B2E] p-4">
      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
        {typeof value === "number" ? <CountUp value={value} prefix={prefix} decimals={decimals} /> : value}
      </p>
      {note && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{note}</p>}
    </div>
  )
}

type Row = { label: string; value: string }

// Card around each chart: title, one-line takeaway, the chart, a table twin
// so every value is readable without hovering, and a download button that
// saves the chart itself as a .png image - only shown while the chart (not
// the table) is on screen, since that's what gets captured.
export function ChartCard({
  title,
  description,
  isEmpty,
  emptyText = "Nothing to show yet.",
  rows,
  valueHeading,
  children,
}: {
  title: string
  description?: string
  isEmpty: boolean
  emptyText?: string
  rows: Row[]
  valueHeading: string
  children: React.ReactNode
}) {
  const [showTable, setShowTable] = useState(false)
  const chartRef = useRef<HTMLDivElement>(null)
  const filename = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")

  return (
    <section className="rounded-3xl border border-slate-200 dark:border-[#233350] bg-white dark:bg-[#121B2E] p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">{title}</h3>
          {description && <p className="text-xs text-slate-500 dark:text-slate-400">{description}</p>}
        </div>
        {!isEmpty && (
          <div className="flex shrink-0 items-center gap-2">
            {!showTable && (
              <button
                type="button"
                onClick={() => downloadChartAsImage(chartRef.current, filename)}
                className="inline-flex items-center gap-1 rounded-full border border-slate-200 dark:border-[#233350] px-3 py-1 text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#1A2740]"
              >
                <Download className="w-3 h-3" /> Download
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowTable(value => !value)}
              aria-pressed={showTable}
              className="rounded-full border border-slate-200 dark:border-[#233350] px-3 py-1 text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#1A2740]"
            >
              {showTable ? "View as chart" : "View as table"}
            </button>
          </div>
        )}
      </div>

      {isEmpty ? (
        <p className="rounded-2xl border border-dashed border-slate-300 dark:border-[#233350] p-6 text-center text-sm text-slate-500 dark:text-slate-400">{emptyText}</p>
      ) : showTable ? (
        <div className="max-h-[280px] overflow-auto rounded-xl border border-slate-100 dark:border-[#233350]">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-[#0B1220] text-left text-xs text-slate-500">
              <tr>
                <th className="px-3 py-2 font-semibold">Item</th>
                <th className="px-3 py-2 text-right font-semibold">{valueHeading}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.label} className="border-t border-slate-100 dark:border-[#233350]">
                  <td className="px-3 py-2 text-slate-700 dark:text-slate-300">{row.label}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-900 dark:text-slate-100">{row.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div ref={chartRef}>{children}</div>
      )}
    </section>
  )
}

const tick = { fill: "var(--viz-muted)", fontSize: 11 }

function truncate(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

// Month-by-month columns. Thin columns (<= 24px) with a rounded top, growing
// from a single baseline; recessive hairline grid; value in the tooltip and the
// table twin rather than a number on every column.
export function MonthlyColumns({
  data,
  seriesLabel,
  format,
}: {
  data: MonthPoint[]
  seriesLabel: string
  format: (value: number) => string
}) {
  return (
    <ChartContainer config={{ value: { label: seriesLabel, color: "var(--viz-series)" } }} className="h-[260px] w-full">
      <BarChart data={data} margin={{ left: 4, right: 8, top: 8, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--viz-grid)" />
        <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: "var(--viz-axis)" }} tick={tick} tickMargin={8} minTickGap={16} />
        <YAxis tickLine={false} axisLine={false} tick={tick} width={44} allowDecimals={false} tickFormatter={value => compactNumber(Number(value))} />
        <ChartTooltip
          cursor={{ fill: "var(--viz-grid)", opacity: 0.4 }}
          content={<ChartTooltipContent formatter={value => <span className="font-semibold">{format(Number(value))}</span>} />}
        />
        <Bar dataKey="value" fill="var(--viz-series)" radius={[4, 4, 0, 0]} maxBarSize={24} />
      </BarChart>
    </ChartContainer>
  )
}

// Month-by-month filled area - the same monthly shape as MonthlyColumns, but
// for a running total (money received, money paid out) where a continuous
// line reads more naturally than discrete columns.
export function MonthlyArea({
  data,
  seriesLabel,
  format,
}: {
  data: MonthPoint[]
  seriesLabel: string
  format: (value: number) => string
}) {
  return (
    <ChartContainer config={{ value: { label: seriesLabel, color: "var(--viz-series)" } }} className="h-[260px] w-full">
      <AreaChart data={data} margin={{ left: 4, right: 8, top: 8, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--viz-grid)" />
        <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: "var(--viz-axis)" }} tick={tick} tickMargin={8} minTickGap={16} />
        <YAxis tickLine={false} axisLine={false} tick={tick} width={44} allowDecimals={false} tickFormatter={value => compactNumber(Number(value))} />
        <ChartTooltip
          cursor={{ stroke: "var(--viz-series)", strokeWidth: 1 }}
          content={<ChartTooltipContent formatter={value => <span className="font-semibold">{format(Number(value))}</span>} />}
        />
        <Area type="monotone" dataKey="value" stroke="var(--viz-series)" fill="var(--viz-series)" fillOpacity={0.15} strokeWidth={2} />
      </AreaChart>
    </ChartContainer>
  )
}

// Month-by-month line - for a count trend (offers of support, visits...),
// visually distinct from the money-shaped area chart above even though
// they're built from the same MonthPoint shape.
export function MonthlyLine({
  data,
  seriesLabel,
  format,
}: {
  data: MonthPoint[]
  seriesLabel: string
  format: (value: number) => string
}) {
  return (
    <ChartContainer config={{ value: { label: seriesLabel, color: "var(--viz-series)" } }} className="h-[260px] w-full">
      <LineChart data={data} margin={{ left: 4, right: 8, top: 8, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--viz-grid)" />
        <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: "var(--viz-axis)" }} tick={tick} tickMargin={8} minTickGap={16} />
        <YAxis tickLine={false} axisLine={false} tick={tick} width={44} allowDecimals={false} tickFormatter={value => compactNumber(Number(value))} />
        <ChartTooltip
          cursor={{ stroke: "var(--viz-series)", strokeWidth: 1 }}
          content={<ChartTooltipContent formatter={value => <span className="font-semibold">{format(Number(value))}</span>} />}
        />
        <Line type="monotone" dataKey="value" stroke="var(--viz-series)" strokeWidth={2} dot={{ r: 3 }} />
      </LineChart>
    </ChartContainer>
  )
}

// A handful of validated, mutually distinct hues (colorblind-safe pairwise
// separation) in a fixed order - assigned by position, never by status
// meaning, since the same StatusPie is reused for several different domains
// (needs, deliveries, withdrawals) that don't share a status vocabulary.
const STATUS_PIE_COLORS = ["#2a78d6", "#059669", "#d97706", "#e11d48", "#7c3aed", "#0891b2"]

// A named-status breakdown as a donut. Identity is carried by the legend and
// direct tooltip labels, never by color alone; zero-value slices (from
// byStatusOrder's fixed status list) are dropped rather than drawn as a
// sliver.
export function StatusPie({ data, format }: { data: RankedPoint[]; format: (value: number) => string }) {
  const colorByName = new Map(data.map((point, i) => [point.name, STATUS_PIE_COLORS[i % STATUS_PIE_COLORS.length]]))
  const nonZero = data.filter(point => point.value > 0)
  const config = Object.fromEntries(data.map(point => [point.name, { label: point.name, color: colorByName.get(point.name) }]))
  return (
    <ChartContainer config={config} className="h-[260px] w-full">
      <PieChart>
        <ChartTooltip
          content={<ChartTooltipContent hideLabel formatter={(value, _name, item) => (
            <span><span className="text-muted-foreground">{String((item as any)?.payload?.name ?? "")}: </span><span className="font-semibold">{format(Number(value))}</span></span>
          )} />}
        />
        <Pie data={nonZero} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} strokeWidth={2} stroke="var(--background)">
          {nonZero.map(entry => (
            <Cell key={entry.name} fill={colorByName.get(entry.name)} />
          ))}
        </Pie>
        <ChartLegend content={<ChartLegendContent nameKey="name" />} />
      </PieChart>
    </ChartContainer>
  )
}

// Horizontal ranked bars, for comparing a handful of named things. One series,
// one color; the value sits at the tip of each bar.
export function RankedBars({
  data,
  seriesLabel,
  format,
}: {
  data: RankedPoint[]
  seriesLabel: string
  format: (value: number) => string
}) {
  const height = Math.max(120, data.length * 44 + 24)
  return (
    <ChartContainer config={{ value: { label: seriesLabel, color: "var(--viz-series)" } }} className="w-full" style={{ height }}>
      <BarChart data={data} layout="vertical" margin={{ left: 4, right: 56, top: 4, bottom: 4 }} barCategoryGap={12}>
        <CartesianGrid horizontal={false} stroke="var(--viz-grid)" />
        <XAxis type="number" hide domain={[0, "dataMax"]} />
        <YAxis
          type="category"
          dataKey="name"
          width={120}
          tickLine={false}
          axisLine={{ stroke: "var(--viz-axis)" }}
          tick={{ fill: "var(--viz-text)", fontSize: 12 }}
          tickFormatter={value => truncate(String(value), 18)}
        />
        <ChartTooltip
          cursor={{ fill: "var(--viz-grid)", opacity: 0.4 }}
          content={<ChartTooltipContent hideLabel formatter={(value, _name, item) => (
            <span><span className="text-muted-foreground">{String((item as any)?.payload?.name ?? "")}: </span><span className="font-semibold">{format(Number(value))}</span></span>
          )} />}
        />
        <Bar dataKey="value" fill="var(--viz-series)" radius={[0, 4, 4, 0]} maxBarSize={24}>
          <LabelList dataKey="value" position="right" fill="var(--viz-text)" fontSize={12} formatter={(value: any) => format(Number(value))} />
        </Bar>
      </BarChart>
    </ChartContainer>
  )
}
