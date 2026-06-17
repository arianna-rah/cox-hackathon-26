'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import {
  X,
  Leaf,
  DollarSign,
  CheckSquare,
  Wind,
  ChevronRight,
  Check,
} from 'lucide-react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  CartesianGrid,
} from 'recharts'
import { useDashboardStore } from '@/stores/dashboardStore'
import { useMapStore } from '@/stores/mapStore'
import { useAnalysisStore } from '@/stores/analysisStore'
import { CHECKLISTS } from '@/lib/checklists'
import { computeProjections } from '@/lib/projections'

const BuildingScene3D = dynamic(() => import('@/components/scene3d/BuildingScene3D'), {
  ssr: false,
})

// ── formatting helpers ──────────────────────────────────────────────────────
const money = (n: number | null | undefined) =>
  n == null ? '—' : `$${Math.round(n).toLocaleString()}`
const tons = (n: number | null | undefined) => (n == null ? '—' : `${n.toFixed(1)} t`)
const pct = (n: number | null | undefined) => (n == null ? '—' : `${n}%`)
const yrs = (n: number | null | undefined) => (n == null ? '—' : `${n} yr`)

function feasClasses(label: string): string {
  if (/strong/i.test(label)) return 'bg-greentop-green/15 text-greentop-green'
  if (/moderate/i.test(label)) return 'bg-greentop-amber/15 text-greentop-amber'
  return 'bg-greentop-red/15 text-greentop-red'
}

// ── sub-components ──────────────────────────────────────────────────────────
function Metric({ label, value, good }: { label: string; value: string; good?: boolean }) {
  return (
    <div className="rounded-xl border border-greentop-border bg-greentop-bg p-3">
      <p className={`font-mono text-base font-bold ${good ? 'text-greentop-green' : 'text-greentop-text'}`}>
        {value}
      </p>
      <p className="mt-0.5 text-[10px] uppercase tracking-wide text-greentop-muted">{label}</p>
    </div>
  )
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-greentop-muted">{label}</span>
      <span className={`font-mono ${strong ? 'font-semibold text-greentop-green' : 'text-greentop-text'}`}>
        {value}
      </span>
    </div>
  )
}

const CHART_TOOLTIP_STYLE = {
  background: '#fffdf7',
  border: '1px solid #e7dcc4',
  borderRadius: 8,
  fontSize: 11,
  color: '#3a3325',
}

// ── tabs ────────────────────────────────────────────────────────────────────
type Tab = 'financial' | 'checklist' | 'environmental'

// ── main page ───────────────────────────────────────────────────────────────
export default function PlanPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()

  const plan = useDashboardStore((s) => s.plans.find((p) => p.id === id))
  const toggleChecklistItem = useDashboardStore((s) => s.toggleChecklistItem)

  const [tab, setTab] = useState<Tab>('financial')

  // Sidebar resize state
  const [sidebarWidth, setSidebarWidth] = useState(520)
  const dragging = useRef(false)
  const startX = useRef(0)
  const startWidth = useRef(520)

  const onDragStart = useCallback((e: React.MouseEvent) => {
    dragging.current = true
    startX.current = e.clientX
    startWidth.current = sidebarWidth
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [sidebarWidth])

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return
      const delta = e.clientX - startX.current
      const next = Math.min(Math.max(startWidth.current + delta, 320), window.innerWidth * 0.75)
      setSidebarWidth(next)
    }
    const onMouseUp = () => {
      if (dragging.current) {
        dragging.current = false
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }
    }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

  // Sync stores so BuildingScene3D renders the right building
  useEffect(() => {
    if (!plan) return
    useMapStore.getState().selectBuilding(plan.building)
    useAnalysisStore.getState().setSolar(plan.solar)
    useAnalysisStore.getState().setSelectedOptionId(plan.selectedOption.id)
  }, [plan])

  if (!plan) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-greentop-bg">
        <div className="text-center">
          <p className="text-greentop-muted">Plan not found.</p>
          <button
            onClick={() => router.push('/dashboard')}
            className="mt-4 text-sm text-greentop-green underline"
          >
            Back to dashboard
          </button>
        </div>
      </div>
    )
  }

  const { selectedOption: opt, dashboard: dash, checklist } = plan
  const m = dash.keyMetrics
  const fb = dash.financialBreakdown
  const env = dash.environmentalImpact
  const incentives = dash.incentives
  const rec = dash.recommendedOption

  // Financial projections
  const netCost = fb.netCost ?? m.netCostAfterIncentives ?? 0
  const annualSavings = fb.annualSavingsOrRevenue ?? m.annualSavings ?? 0
  const co2PerYear = m.co2ReductionPerYear ?? 0
  const projections = computeProjections(netCost, annualSavings, co2PerYear, 25)

  // Checklist progress
  const checkItems = CHECKLISTS[opt.id] ?? []
  const doneCount = checkItems.filter((item) => checklist[item.id]).length

  // Environmental equivalencies (real EPA/EIA factors)
  const carsOffRoad = co2PerYear > 0 ? (co2PerYear / 4.6).toFixed(1) : null
  const treesEquivalent = co2PerYear > 0 ? Math.round(co2PerYear / 0.022) : null
  const homesPowered =
    opt.id === 'solar' && opt.annualKwh ? (opt.annualKwh / 10_500).toFixed(1) : null

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-greentop-bg">
      {/* Top bar */}
      <header className="flex shrink-0 items-center gap-3 border-b border-greentop-border bg-greentop-surface px-5 py-3">
        <div className="flex items-center gap-2">
          <Leaf className="h-4 w-4 text-greentop-green" />
          <span className="font-mono text-[11px] uppercase tracking-widest text-greentop-green">GreenTop</span>
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-greentop-muted" />
        <span className="truncate text-sm font-semibold text-greentop-text">{plan.name}</span>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => router.push('/dashboard')}
            aria-label="Back to dashboard"
            className="rounded-lg p-1.5 text-greentop-muted transition-colors hover:bg-greentop-bg hover:text-greentop-text"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── Sidebar ── */}
        <aside
          style={{ width: sidebarWidth, minWidth: 320 }}
          className="flex shrink-0 flex-col overflow-hidden border-r border-greentop-border bg-greentop-surface"
        >
          {/* Selected option card */}
          <div className="border-b border-greentop-border p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-wide text-greentop-green">{rec.category}</p>
                <h2 className="mt-0.5 text-lg font-bold text-greentop-text">{opt.name}</h2>
                <p className="mt-1 text-sm text-greentop-muted">{rec.shortHeadline}</p>
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${feasClasses(rec.feasibilityLabel)}`}>
                {rec.feasibilityLabel}
              </span>
            </div>
          </div>

          {/* Tab buttons */}
          <div className="flex shrink-0 border-b border-greentop-border">
            {([
              { id: 'financial', label: 'Financial', icon: DollarSign },
              { id: 'checklist', label: 'Checklist', icon: CheckSquare },
              { id: 'environmental', label: 'Environmental', icon: Wind },
            ] as const).map(({ id: tid, label, icon: Icon }) => (
              <button
                key={tid}
                onClick={() => setTab(tid)}
                className={`flex flex-1 items-center justify-center gap-1.5 border-b-2 px-3 py-3 text-xs font-medium transition-colors ${
                  tab === tid
                    ? 'border-greentop-green text-greentop-green'
                    : 'border-transparent text-greentop-muted hover:text-greentop-text'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto">
            {/* ── Financial tab ── */}
            {tab === 'financial' && (
              <div className="flex flex-col gap-5 p-5">
                {/* Key metrics */}
                <section>
                  <p className="mb-2 text-[11px] font-mono uppercase tracking-widest text-greentop-muted">Key Metrics</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Metric label="Upfront cost" value={money(m.upfrontCost)} />
                    <Metric label="Net after incentives" value={money(m.netCostAfterIncentives)} good />
                    <Metric label="Annual savings" value={`${money(m.annualSavings)}/yr`} good />
                    <Metric label="Payback" value={yrs(m.paybackYears)} />
                    <Metric label="ROI" value={pct(m.roiPercent)} good />
                    <Metric label="CO₂ / yr" value={tons(m.co2ReductionPerYear)} good />
                    <Metric label="10-year value" value={money(m.tenYearValue)} good />
                    <Metric label="20-year value" value={money(m.twentyYearValue)} good />
                  </div>
                </section>

                {/* Cumulative value chart */}
                <section>
                  <p className="mb-1 text-[11px] font-mono uppercase tracking-widest text-greentop-muted">
                    25-Year Cumulative Value
                  </p>
                  <p className="mb-2 text-[11px] text-greentop-muted">
                    Break-even where the line crosses $0
                  </p>
                  <div className="h-[180px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={projections} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                        <CartesianGrid stroke="#e7dcc4" strokeDasharray="3 3" />
                        <XAxis
                          dataKey="year"
                          tick={{ fill: '#8a7c63', fontSize: 10 }}
                          tickLine={false}
                          axisLine={false}
                          label={{ value: 'Year', position: 'insideBottom', offset: -2, fill: '#8a7c63', fontSize: 10 }}
                        />
                        <YAxis
                          tick={{ fill: '#8a7c63', fontSize: 10 }}
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                          width={48}
                        />
                        <Tooltip
                          contentStyle={CHART_TOOLTIP_STYLE}
                          labelStyle={{ color: '#3a3325' }}
                          itemStyle={{ color: '#22c55e' }}
                          formatter={(v) => [`$${Math.round(Number(v)).toLocaleString()}`, 'Net value']}
                          labelFormatter={(l) => `Year ${l}`}
                        />
                        <ReferenceLine y={0} stroke="#4ade80" strokeDasharray="4 2" label={{ value: 'Break-even', fill: '#4ade80', fontSize: 9 }} />
                        <Line
                          type="monotone"
                          dataKey="cumulativeNet"
                          stroke="#22c55e"
                          strokeWidth={2}
                          dot={false}
                          activeDot={{ r: 4, fill: '#22c55e' }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </section>

                {/* Cost breakdown */}
                <section>
                  <p className="mb-2 text-[11px] font-mono uppercase tracking-widest text-greentop-muted">Cost Breakdown</p>
                  <div className="space-y-1.5 rounded-xl border border-greentop-border bg-greentop-bg p-4">
                    <Row label="Gross installation" value={money(fb.grossCost)} />
                    {fb.rebates != null && <Row label="Rebates / incentives" value={`– ${money(fb.rebates)}`} />}
                    {fb.communityDiscount != null && <Row label="Community discount" value={`– ${money(fb.communityDiscount)}`} />}
                    {fb.grantValue != null && <Row label="Green Block grant" value={`– ${money(fb.grantValue)}`} />}
                    {fb.estimatedMaintenanceCost != null && <Row label="Est. maintenance / yr" value={money(fb.estimatedMaintenanceCost)} />}
                    <div className="border-t border-greentop-border pt-2">
                      <Row label="Net cost" value={money(fb.netCost)} strong />
                    </div>
                    <Row label="Annual savings / revenue" value={`${money(fb.annualSavingsOrRevenue)}/yr`} />
                  </div>
                  {fb.breakEvenExplanation && (
                    <p className="mt-2 text-xs leading-relaxed text-greentop-muted">{fb.breakEvenExplanation}</p>
                  )}
                </section>

                {/* Incentives */}
                {incentives.availableIncentives.length > 0 && (
                  <section>
                    <p className="mb-2 text-[11px] font-mono uppercase tracking-widest text-greentop-muted">Available Incentives</p>
                    <div className="space-y-2 rounded-xl border border-greentop-border bg-greentop-bg p-4">
                      {incentives.availableIncentives.map((inc, i) => (
                        <div key={i} className="flex items-start justify-between gap-2 text-sm">
                          <div className="min-w-0">
                            <p className="text-greentop-text">{inc.name}</p>
                            {inc.description && <p className="text-[11px] text-greentop-muted">{inc.description}</p>}
                          </div>
                          <span className="shrink-0 font-mono text-greentop-green">
                            {inc.estimatedValue != null ? money(inc.estimatedValue) : '—'}
                          </span>
                        </div>
                      ))}
                      {incentives.estimatedTotalIncentiveValue != null && (
                        <div className="flex items-center justify-between border-t border-greentop-border pt-2 text-sm">
                          <span className="font-medium text-greentop-text">Total incentives</span>
                          <span className="font-mono font-semibold text-greentop-green">
                            {money(incentives.estimatedTotalIncentiveValue)}
                          </span>
                        </div>
                      )}
                    </div>
                  </section>
                )}
              </div>
            )}

            {/* ── Checklist tab ── */}
            {tab === 'checklist' && (
              <div className="flex flex-col gap-4 p-5">
                {checkItems.length === 0 ? (
                  <p className="text-sm text-greentop-muted">No checklist available for this option.</p>
                ) : (
                  <>
                    {/* Progress */}
                    <div>
                      <div className="mb-1.5 flex items-center justify-between text-sm">
                        <span className="font-medium text-greentop-text">{doneCount} of {checkItems.length} completed</span>
                        <span className="font-mono text-greentop-green">
                          {Math.round((doneCount / checkItems.length) * 100)}%
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-greentop-border">
                        <div
                          className="h-full rounded-full bg-greentop-green transition-all duration-300"
                          style={{ width: `${(doneCount / checkItems.length) * 100}%` }}
                        />
                      </div>
                    </div>

                    {/* Items */}
                    <div className="space-y-2">
                      {checkItems.map((item) => {
                        const done = !!checklist[item.id]
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => toggleChecklistItem(plan.id, item.id)}
                            className={`flex w-full items-start gap-3 rounded-xl border p-4 text-left transition-colors ${
                              done
                                ? 'border-greentop-green/40 bg-greentop-green/5'
                                : 'border-greentop-border bg-greentop-bg hover:border-greentop-green/50'
                            }`}
                          >
                            <span
                              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors ${
                                done
                                  ? 'border-greentop-green bg-greentop-green'
                                  : 'border-greentop-border'
                              }`}
                            >
                              {done && <Check className="h-3 w-3 text-white" />}
                            </span>
                            <div className="min-w-0">
                              <p className={`text-sm font-medium leading-snug ${done ? 'text-greentop-muted line-through' : 'text-greentop-text'}`}>
                                {item.task}
                              </p>
                              <p className="mt-1 text-xs leading-relaxed text-greentop-muted">{item.description}</p>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ── Environmental tab ── */}
            {tab === 'environmental' && (
              <div className="flex flex-col gap-5 p-5">
                {/* CO2 metrics */}
                <section>
                  <p className="mb-2 text-[11px] font-mono uppercase tracking-widest text-greentop-muted">Carbon Impact</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Metric label="CO₂ avoided / yr" value={tons(env.co2ReductionPerYear)} good />
                    <Metric label="Lifetime CO₂" value={tons(env.lifetimeCo2Reduction)} good />
                  </div>
                  {env.plainEnglishEquivalent && (
                    <div className="mt-2 flex items-start gap-1.5 rounded-xl border border-greentop-green/30 bg-greentop-green/5 p-3">
                      <Leaf className="mt-0.5 h-3.5 w-3.5 shrink-0 text-greentop-green" />
                      <p className="text-sm text-greentop-text">{env.plainEnglishEquivalent}</p>
                    </div>
                  )}
                </section>

                {/* Other environmental benefits */}
                <section className="space-y-2 text-xs text-greentop-muted">
                  {env.stormwaterBenefit && (
                    <p className="flex items-start gap-1.5 leading-relaxed">
                      <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-greentop-green" />
                      {env.stormwaterBenefit}
                    </p>
                  )}
                  {env.heatIslandBenefit && (
                    <p className="flex items-start gap-1.5 leading-relaxed">
                      <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-greentop-green" />
                      {env.heatIslandBenefit}
                    </p>
                  )}
                  {env.biodiversityBenefit && (
                    <p className="flex items-start gap-1.5 leading-relaxed">
                      <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-greentop-green" />
                      {env.biodiversityBenefit}
                    </p>
                  )}
                </section>

                {/* CO2 accumulation chart */}
                <section>
                  <p className="mb-1 text-[11px] font-mono uppercase tracking-widest text-greentop-muted">
                    Lifetime CO₂ Avoided
                  </p>
                  <div className="h-[160px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={projections} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                        <CartesianGrid stroke="#e7dcc4" strokeDasharray="3 3" />
                        <XAxis
                          dataKey="year"
                          tick={{ fill: '#8a7c63', fontSize: 10 }}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis
                          tick={{ fill: '#8a7c63', fontSize: 10 }}
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(v) => `${v.toFixed(0)}t`}
                          width={36}
                        />
                        <Tooltip
                          contentStyle={CHART_TOOLTIP_STYLE}
                          labelStyle={{ color: '#3a3325' }}
                          itemStyle={{ color: '#22c55e' }}
                          formatter={(v) => [`${Number(v).toFixed(1)} tons`, 'CO₂ avoided']}
                          labelFormatter={(l) => `Year ${l}`}
                        />
                        <Area
                          type="monotone"
                          dataKey="cumulativeCO2"
                          stroke="#22c55e"
                          fill="#22c55e"
                          fillOpacity={0.15}
                          strokeWidth={2}
                          dot={false}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </section>

                {/* EPA/EIA equivalencies */}
                <section>
                  <p className="mb-2 text-[11px] font-mono uppercase tracking-widest text-greentop-muted">Annual Impact Equivalencies</p>
                  <div className="space-y-2 rounded-xl border border-greentop-border bg-greentop-bg p-4 text-sm">
                    {carsOffRoad && (
                      <div className="flex items-center justify-between">
                        <span className="text-greentop-muted">Cars off the road</span>
                        <span className="font-mono font-semibold text-greentop-green">{carsOffRoad}</span>
                      </div>
                    )}
                    {treesEquivalent && (
                      <div className="flex items-center justify-between">
                        <span className="text-greentop-muted">Trees planted</span>
                        <span className="font-mono font-semibold text-greentop-green">{treesEquivalent.toLocaleString()}</span>
                      </div>
                    )}
                    {homesPowered && (
                      <div className="flex items-center justify-between">
                        <span className="text-greentop-muted">Homes powered</span>
                        <span className="font-mono font-semibold text-greentop-green">{homesPowered}</span>
                      </div>
                    )}
                  </div>
                  <p className="mt-2 text-[10px] leading-relaxed text-greentop-muted">
                    Sources: EPA (2024) avg passenger vehicle = 4.6 metric tons CO₂/yr; EPA avg tree absorbs ~22 kg CO₂/yr; EIA (2023) avg US home uses 10,500 kWh/yr.
                  </p>
                </section>
              </div>
            )}
          </div>
        </aside>

        {/* ── Drag handle ── */}
        <div
          onMouseDown={onDragStart}
          className="relative z-10 w-1 shrink-0 cursor-col-resize bg-greentop-border transition-colors hover:bg-greentop-green/60 active:bg-greentop-green"
        />

        {/* ── 3D scene ── */}
        <div className="relative flex-1 overflow-hidden bg-greentop-bg">
          <BuildingScene3D />
        </div>
      </div>
    </div>
  )
}
