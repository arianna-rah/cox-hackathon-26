'use client'

import { useEffect, useRef, useState } from 'react'
import {
  Trophy,
  Sparkles,
  Users,
  ArrowLeft,
  TriangleAlert,
  Satellite,
  Leaf,
  DollarSign,
  Clock,
  TrendingUp,
  Droplets,
  Thermometer,
  ListChecks,
  BarChart3,
  ChevronDown,
  Building2,
  ShieldCheck,
  Bot,
  Zap,
} from 'lucide-react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from 'recharts'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { useMapStore } from '@/stores/mapStore'
import { useAnalysisStore } from '@/stores/analysisStore'
import { buildFallbackDashboard } from '@/lib/dashboard'
import { optionEnergyImpact, billToAnnualKwh } from '@/lib/scoring'
import { coveragePlan } from '@/lib/coverage'
import type { DashboardAnalysis, DashRisk } from '@/types'

// ── formatting ──
const money = (n: number | null | undefined) =>
  n == null ? '—' : `$${Math.round(n).toLocaleString()}`
const years = (n: number | null | undefined) => (n == null ? '—' : `${n} yr`)
const pct = (n: number | null | undefined) => (n == null ? '—' : `${n}%`)
const tons = (n: number | null | undefined) => (n == null ? '—' : `${n} t`)

const GREEN = '#22c55e'
const GREEN_DIM = '#15803d'

function sevClasses(sev: DashRisk['severity']): string {
  if (sev === 'High') return 'border-canopy-red/40 bg-canopy-red/10 text-canopy-red'
  if (sev === 'Medium') return 'border-canopy-amber/40 bg-canopy-amber/10 text-canopy-amber'
  return 'border-canopy-border bg-canopy-bg text-canopy-muted'
}

function feasClasses(label: string): string {
  if (/strong/i.test(label)) return 'bg-canopy-green/15 text-canopy-green'
  if (/moderate/i.test(label)) return 'bg-canopy-amber/15 text-canopy-amber'
  return 'bg-canopy-red/15 text-canopy-red'
}

/** Short chart-axis label from an option name. */
function shortName(name: string): string {
  return name
    .replace(/\(.*?\)/g, '')
    .replace('Coating', '')
    .replace('Harvesting', '')
    .replace('Rooftop ', '')
    .trim()
    .slice(0, 14)
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Leaf
  title: string
  children: React.ReactNode
}) {
  return (
    <div>
      <p className="mb-2 flex items-center gap-1.5 text-xs font-mono uppercase tracking-widest text-canopy-muted">
        <Icon className="h-3.5 w-3.5 text-canopy-green" />
        {title}
      </p>
      {children}
    </div>
  )
}

function Metric({
  label,
  value,
  good,
}: {
  label: string
  value: string
  good?: boolean
}) {
  return (
    <div className="rounded-xl border border-canopy-border bg-canopy-bg p-3">
      <p className={`font-mono text-base font-bold ${good ? 'text-canopy-green' : 'text-canopy-text'}`}>
        {value}
      </p>
      <p className="mt-0.5 text-[10px] uppercase tracking-wide text-canopy-muted">{label}</p>
    </div>
  )
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-canopy-muted">{label}</span>
      <span className={`font-mono ${strong ? 'font-semibold text-canopy-green' : 'text-canopy-text'}`}>
        {value}
      </span>
    </div>
  )
}

/** Compact horizontal bar chart for the option comparison. */
function MiniBars({
  data,
  unit,
}: {
  data: { name: string; value: number; rec: boolean }[]
  unit: string
}) {
  return (
    <div className="h-[150px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart layout="vertical" data={data} margin={{ top: 2, right: 12, bottom: 2, left: 0 }}>
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="name"
            width={86}
            tick={{ fill: '#93a99b', fontSize: 10 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            cursor={{ fill: 'rgba(34,197,94,0.08)' }}
            contentStyle={{
              background: '#111f14',
              border: '1px solid #1e3a22',
              borderRadius: 8,
              fontSize: 11,
            }}
            labelStyle={{ color: '#f0fdf4' }}
            formatter={(v) => [`${Number(v).toLocaleString()} ${unit}`, '']}
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={12}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.rec ? GREEN : GREEN_DIM} fillOpacity={d.rec ? 1 : 0.55} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function Results() {
  const storedDash = useAnalysisStore((s) => s.dashboardAnalysis)
  const result = useAnalysisStore((s) => s.result)
  const solar = useAnalysisStore((s) => s.solar)
  // Shared with the 3D scene: which roof option is focused. Either side can set it.
  const selectedOptionId = useAnalysisStore((s) => s.selectedOptionId)
  const setSelectedOptionId = useAnalysisStore((s) => s.setSelectedOptionId)
  const advanceTo = useMapStore((s) => s.advanceTo)
  const [chartsOpen, setChartsOpen] = useState(false)

  // When the selection changes (incl. from clicking a widget on the 3D roof),
  // scroll the matching comparison row into view so the link feels alive.
  const selectedRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    selectedRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [selectedOptionId])

  // Prefer the stored (Gemini or fallback) dashboard. If somehow absent but we
  // have scored results, build the deterministic fallback on the fly.
  const dash: DashboardAnalysis | null =
    storedDash ??
    (result
      ? buildFallbackDashboard(
          result.building,
          result.preferences,
          result.rankedOptions,
          result.communityBonus,
          solar,
        )
      : null)

  if (!dash) return null

  const rec = dash.recommendedOption
  const m = dash.keyMetrics
  const fb = dash.financialBreakdown
  const env = dash.environmentalImpact
  const roof = dash.roofSummary
  const cmp = dash.optionComparison
  const ci = dash.communityImpact
  const incentives = dash.incentives
  const isGemini = dash.source === 'gemini'

  // Map dashboard rows (which carry names) back to scored-option ids so the
  // comparison list can drive — and reflect — the shared 3D selection.
  const idByName = new Map((result?.rankedOptions ?? []).map((o) => [o.name, o.id]))

  // The recommended scored option (matched from the dashboard recommendation),
  // so energy impact and roof-use are specific to whatever actually won.
  const recOption =
    result?.rankedOptions.find((o) => o.name === rec.name) ?? result?.rankedOptions[0] ?? null
  // Use the owner's real bill (if they entered one) for building energy use.
  const overrideKwh = result?.preferences.monthlyElectricBill
    ? billToAnnualKwh(result.preferences.monthlyElectricBill)
    : null
  const energy = result ? optionEnergyImpact(result.building, recOption, solar, overrideKwh) : null
  const coverage = recOption ? coveragePlan(recOption.id, solar) : null

  const savingsData = cmp.map((o) => ({
    name: shortName(o.name),
    value: o.annualSavings ?? 0,
    rec: o.name === rec.name,
  }))
  const co2Data = cmp.map((o) => ({
    name: shortName(o.name),
    value: o.co2ReductionPerYear ?? 0,
    rec: o.name === rec.name,
  }))
  const scoreData = cmp.map((o) => ({
    name: shortName(o.name),
    value: o.score ?? 0,
    rec: o.name === rec.name,
  }))

  return (
    <div className="flex flex-col gap-5 p-5">
      {/* provenance badge */}
      <div className="flex items-center gap-2 self-start rounded-full border border-canopy-border bg-canopy-bg px-2.5 py-1 text-[11px] text-canopy-muted">
        {isGemini ? (
          <>
            <Bot className="h-3.5 w-3.5 text-canopy-green" /> Generated by Canopy AI · Gemini
          </>
        ) : (
          <>
            <Satellite className="h-3.5 w-3.5 text-canopy-green" /> Canopy deterministic analysis
          </>
        )}
      </div>

      {/* ── 1. Recommendation hero ── */}
      <div className="rounded-2xl border border-canopy-green/40 bg-canopy-green/5 p-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="flex items-center gap-2 text-canopy-green">
            <Trophy className="h-4 w-4" />
            <span className="text-xs font-mono uppercase tracking-widest">Recommended</span>
          </span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${feasClasses(rec.feasibilityLabel)}`}>
            {rec.feasibilityLabel}
          </span>
        </div>
        <h3 className="text-xl font-bold text-canopy-text">{rec.name}</h3>
        {rec.category && <p className="text-[11px] uppercase tracking-wide text-canopy-green">{rec.category}</p>}
        <p className="mt-1 text-sm text-canopy-muted">{rec.shortHeadline}</p>

        <div className="mt-3 flex flex-wrap gap-1.5">
          <span className="rounded-full bg-canopy-green/15 px-2 py-0.5 text-[11px] text-canopy-green">
            {rec.confidenceLabel}
          </span>
          {rec.primaryReason && (
            <span className="rounded-full bg-canopy-bg px-2 py-0.5 text-[11px] text-canopy-muted">
              {rec.primaryReason}
            </span>
          )}
        </div>

        <div className="mt-3 flex items-start gap-1.5">
          <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-canopy-green" />
          <p className="text-sm leading-relaxed text-canopy-text">{rec.whyThisWins}</p>
        </div>
      </div>

      {/* ── 2. Key metrics ── */}
      <Section icon={BarChart3} title="Key Metrics">
        <div className="grid grid-cols-2 gap-2.5">
          <Metric label="Upfront cost" value={money(m.upfrontCost)} />
          <Metric label="Net after incentives" value={money(m.netCostAfterIncentives)} good />
          <Metric label="Annual savings" value={`${money(m.annualSavings)}/yr`} good />
          <Metric label="Payback" value={years(m.paybackYears)} />
          <Metric label="ROI" value={pct(m.roiPercent)} good />
          <Metric label="CO₂ / yr" value={tons(m.co2ReductionPerYear)} good />
          <Metric label="10-year value" value={money(m.tenYearValue)} good />
          <Metric label="20-year value" value={money(m.twentyYearValue)} good />
        </div>
      </Section>

      {/* ── 2b. Energy & roof use (specific to the recommended option) ── */}
      {energy && (
        <Section icon={Zap} title="Energy & Roof Use">
          <div className="rounded-xl border border-canopy-green/30 bg-canopy-green/5 p-4">
            <div className="grid grid-cols-2 gap-2.5">
              <Metric
                label={energy.usingActual ? 'Building uses (actual)' : 'Building uses (est.)'}
                value={`${energy.buildingAnnualKwh.toLocaleString()} kWh/yr`}
              />
              {energy.kind === 'production' && (
                <Metric
                  label="Solar produces"
                  value={energy.optionKwh ? `${energy.optionKwh.toLocaleString()} kWh/yr` : '—'}
                  good
                />
              )}
              {energy.kind === 'savings' && (
                <Metric
                  label="Energy saved"
                  value={energy.optionKwh ? `~${energy.optionKwh.toLocaleString()} kWh/yr` : '—'}
                  good
                />
              )}
              {energy.kind === 'revenue' && (
                <Metric label="Annual revenue" value={`${money(energy.annualDollars)}/yr`} good />
              )}
              {energy.kind === 'stormwater' && (
                <Metric label="Stormwater saved" value={`${money(energy.annualDollars)}/yr`} good />
              )}
            </div>

            {energy.offsetPct != null && (
              <div className="mt-3">
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-canopy-muted">
                    <Zap className="h-3 w-3 text-canopy-green" />
                    {energy.kind === 'production'
                      ? 'Covers your electricity'
                      : 'Cuts your electricity use'}
                  </span>
                  <span className="font-mono font-semibold text-canopy-green">
                    {energy.offsetPct}%
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-canopy-border">
                  <div
                    className="h-full rounded-full bg-canopy-green"
                    style={{ width: `${energy.offsetPct}%` }}
                  />
                </div>
              </div>
            )}

            {(energy.kind === 'production' || energy.kind === 'savings') &&
              energy.annualDollars > 0 && (
                <div className="mt-3 flex items-center justify-between border-t border-canopy-border pt-2 text-sm">
                  <span className="text-canopy-muted">Estimated energy savings</span>
                  <span className="font-mono font-semibold text-canopy-green">
                    {money(energy.annualDollars)}/yr
                  </span>
                </div>
              )}

            {/* Option-specific roof use: how much to cover and what to keep clear */}
            {coverage && (
              <div className="mt-3 border-t border-canopy-border pt-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5 text-canopy-muted">
                    <Building2 className="h-3.5 w-3.5 text-canopy-green" /> {coverage.label}
                  </span>
                  <span className="font-mono font-semibold text-canopy-green">
                    {coverage.mode === 'catchment'
                      ? 'full roof'
                      : coverage.mode === 'footprint'
                        ? `~${coverage.coveredPct}% of roof`
                        : `${coverage.coveredPct}% of roof`}
                  </span>
                </div>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-canopy-border">
                  <div
                    className="h-full bg-canopy-green"
                    style={{ width: `${coverage.coveredPct}%` }}
                  />
                </div>
                <p className="mt-2 text-[11px] leading-snug text-canopy-muted">{coverage.note}</p>
              </div>
            )}
          </div>
          <p className="mt-2 text-[11px] text-canopy-muted">
            {energy.usingActual
              ? 'Building use is from your entered bill. '
              : 'Building use is estimated from floor area and type (EIA CBECS 2018). '}
            Solar production and panel coverage are measured by the Google Solar API; other figures
            are modeled estimates.
          </p>
        </Section>
      )}

      {/* ── 3. Cost & ROI breakdown ── */}
      <Section icon={DollarSign} title="Cost & ROI Breakdown">
        <div className="space-y-2 rounded-xl border border-canopy-border bg-canopy-bg p-4 text-sm">
          <Row label="Gross installation" value={money(fb.grossCost)} />
          {fb.rebates != null && <Row label="Rebates / incentives" value={`– ${money(fb.rebates)}`} />}
          {fb.communityDiscount != null && (
            <Row label="Community discount" value={`– ${money(fb.communityDiscount)}`} />
          )}
          {fb.grantValue != null && <Row label="Green Block grant" value={`– ${money(fb.grantValue)}`} />}
          {fb.estimatedMaintenanceCost != null && (
            <Row label="Est. maintenance / yr" value={money(fb.estimatedMaintenanceCost)} />
          )}
          <div className="border-t border-canopy-border pt-2">
            <Row label="Net cost" value={money(fb.netCost)} strong />
          </div>
          <Row label="Annual savings / revenue" value={`${money(fb.annualSavingsOrRevenue)}/yr`} />
        </div>
        <p className="mt-2 text-xs leading-relaxed text-canopy-muted">{fb.breakEvenExplanation}</p>
        {fb.investmentTimeline && (
          <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-canopy-bg px-2.5 py-1 text-[11px] text-canopy-green">
            <Clock className="h-3 w-3" /> {fb.investmentTimeline} investment
          </span>
        )}
      </Section>

      {/* ── 4. Environmental impact ── */}
      <Section icon={Leaf} title="Environmental Impact">
        <div className="rounded-xl border border-canopy-green/30 bg-canopy-green/5 p-4">
          <div className="grid grid-cols-2 gap-2.5">
            <Metric label="CO₂ avoided / yr" value={tons(env.co2ReductionPerYear)} good />
            <Metric label="Lifetime CO₂" value={tons(env.lifetimeCo2Reduction)} good />
          </div>
          {env.plainEnglishEquivalent && (
            <p className="mt-3 flex items-start gap-1.5 text-sm text-canopy-text">
              <Leaf className="mt-0.5 h-3.5 w-3.5 shrink-0 text-canopy-green" />
              {env.plainEnglishEquivalent}
            </p>
          )}
          <div className="mt-3 space-y-1.5 text-xs text-canopy-muted">
            {env.stormwaterBenefit && (
              <p className="flex items-start gap-1.5">
                <Droplets className="mt-0.5 h-3 w-3 shrink-0 text-canopy-green" />
                {env.stormwaterBenefit}
              </p>
            )}
            {env.heatIslandBenefit && (
              <p className="flex items-start gap-1.5">
                <Thermometer className="mt-0.5 h-3 w-3 shrink-0 text-canopy-green" />
                {env.heatIslandBenefit}
              </p>
            )}
            {env.biodiversityBenefit && (
              <p className="flex items-start gap-1.5">
                <Leaf className="mt-0.5 h-3 w-3 shrink-0 text-canopy-green" />
                {env.biodiversityBenefit}
              </p>
            )}
          </div>
        </div>
      </Section>

      {/* ── 5. Roof feasibility ── */}
      <Section icon={Building2} title="Roof Feasibility">
        <div className="rounded-xl border border-canopy-border bg-canopy-bg p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${feasClasses(rec.feasibilityLabel)}`}>
              {rec.feasibilityLabel}
            </span>
            <span className="text-[11px] text-canopy-muted">{roof.dataConfidence}</span>
          </div>
          <p className="text-sm text-canopy-text">{roof.address}</p>
          <div className="mt-3 space-y-1.5 text-sm">
            <Row label="Roof area" value={roof.roofArea != null ? `${roof.roofArea.toLocaleString()} ft²` : '—'} />
            {roof.usableRoofArea != null && (
              <Row label="Usable area" value={`${roof.usableRoofArea.toLocaleString()} ft²`} />
            )}
            <Row label="Solar potential" value={roof.solarPotential || '—'} />
            <Row label="Sunlight" value={roof.sunlightSummary || '—'} />
          </div>
          {roof.structuralNotes && (
            <p className="mt-2 text-xs text-canopy-muted">{roof.structuralNotes}</p>
          )}
        </div>
      </Section>

      {/* ── 6. Option comparison (synced with the 3D roof widgets) ── */}
      <Section icon={TrendingUp} title="Option Comparison">
        <p className="mb-2 -mt-1 text-[11px] text-canopy-muted">
          Tap an option to highlight it on the 3D roof.
        </p>
        <div className="space-y-1.5">
          {cmp.map((o) => {
            const oid = idByName.get(o.name)
            const isSelected = oid != null && oid === selectedOptionId
            const isRec = o.name === rec.name
            return (
              <button
                type="button"
                key={o.name}
                ref={isSelected ? selectedRef : undefined}
                onClick={() => oid && setSelectedOptionId(oid)}
                className={`w-full rounded-xl border p-3 text-left transition-colors ${
                  isSelected
                    ? 'border-canopy-green bg-canopy-green/10 ring-1 ring-canopy-green'
                    : isRec
                      ? 'border-canopy-green/50 bg-canopy-green/5 hover:bg-canopy-green/10'
                      : 'border-canopy-border bg-canopy-bg hover:border-canopy-green/50'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="font-mono text-xs text-canopy-muted">{o.rank}.</span>
                    <span className={`truncate text-sm font-medium ${isRec ? 'text-canopy-green' : 'text-canopy-text'}`}>
                      {o.name}
                    </span>
                    {isRec && (
                      <span className="shrink-0 rounded-full bg-canopy-green/15 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-canopy-green">
                        Top
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 rounded-full bg-canopy-bg px-2 py-0.5 font-mono text-[11px] text-canopy-green">
                    {o.score != null ? `${o.score}` : '—'}
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-4 gap-1 text-center">
                  <div>
                    <p className="font-mono text-[11px] text-canopy-text">{money(o.netCostAfterIncentives)}</p>
                    <p className="text-[9px] uppercase text-canopy-muted">Net</p>
                  </div>
                  <div>
                    <p className="font-mono text-[11px] text-canopy-text">{years(o.paybackYears)}</p>
                    <p className="text-[9px] uppercase text-canopy-muted">Payback</p>
                  </div>
                  <div>
                    <p className="font-mono text-[11px] text-canopy-text">{tons(o.co2ReductionPerYear)}</p>
                    <p className="text-[9px] uppercase text-canopy-muted">CO₂</p>
                  </div>
                  <div>
                    <p className="font-mono text-[11px] text-canopy-text">{o.maintenanceLevel || '—'}</p>
                    <p className="text-[9px] uppercase text-canopy-muted">Maint.</p>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </Section>

      {/* ── 7. Charts (collapsible) ── */}
      <div>
        <button
          onClick={() => setChartsOpen((v) => !v)}
          className="flex w-full items-center justify-between rounded-xl border border-canopy-border bg-canopy-bg px-4 py-3 text-sm font-medium text-canopy-text hover:border-canopy-green/50"
        >
          <span className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-canopy-green" /> Compare visually
          </span>
          <ChevronDown className={`h-4 w-4 transition-transform ${chartsOpen ? 'rotate-180' : ''}`} />
        </button>
        {chartsOpen && (
          <div className="mt-2 space-y-4">
            <div>
              <p className="mb-1 text-[11px] text-canopy-muted">Annual savings ($/yr)</p>
              <MiniBars data={savingsData} unit="$/yr" />
            </div>
            <div>
              <p className="mb-1 text-[11px] text-canopy-muted">CO₂ reduction (t/yr)</p>
              <MiniBars data={co2Data} unit="t/yr" />
            </div>
            <div>
              <p className="mb-1 text-[11px] text-canopy-muted">Canopy score</p>
              <MiniBars data={scoreData} unit="pts" />
            </div>
          </div>
        )}
      </div>

      <Separator className="bg-canopy-border" />

      {/* ── 8. Community / block-level ── */}
      <Section icon={Users} title="Community Impact">
        <div className="rounded-2xl border border-canopy-green/30 bg-canopy-surface p-4">
          {ci.greenBlockGrantEligibility && /eligible now/i.test(ci.greenBlockGrantEligibility) && (
            <span className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-canopy-green px-2.5 py-1 text-[11px] font-semibold text-canopy-bg">
              <ShieldCheck className="h-3 w-3" /> Green Block eligible
            </span>
          )}
          <p className="text-sm text-canopy-text">{ci.individualImpact}</p>
          <p className="mt-2 text-sm text-canopy-green">{ci.blockLevelImpact}</p>

          <div className="mt-3 space-y-1.5 text-sm">
            {ci.bulkDiscountSavings != null && (
              <Row label="Bulk discount savings" value={money(ci.bulkDiscountSavings)} />
            )}
            <Row label="Pooled stormwater" value={`${money(ci.pooledStormwaterCredit)}/yr`} />
            {ci.neighborhoodCo2Reduction != null && (
              <Row label="Neighborhood CO₂ / yr" value={tons(ci.neighborhoodCo2Reduction)} />
            )}
            <div className="flex items-center justify-between border-t border-canopy-border pt-2">
              <span className="text-canopy-muted">Green Block grant</span>
              {ci.greenBlockGrantValue != null ? (
                <span className="font-mono font-semibold text-canopy-green">
                  {money(ci.greenBlockGrantValue)} ✓
                </span>
              ) : (
                <span className="font-mono text-canopy-muted">{ci.greenBlockGrantEligibility}</span>
              )}
            </div>
          </div>

          {ci.recommendation && <p className="mt-3 text-xs text-canopy-muted">{ci.recommendation}</p>}
        </div>
      </Section>

      {/* ── 9. Rebates & incentives ── */}
      <Section icon={DollarSign} title="Rebates & Incentives">
        <div className="rounded-xl border border-canopy-border bg-canopy-bg p-4">
          <div className="space-y-2">
            {incentives.availableIncentives.map((inc, i) => (
              <div key={i} className="flex items-start justify-between gap-2 text-sm">
                <div className="min-w-0">
                  <p className="text-canopy-text">{inc.name}</p>
                  {inc.description && <p className="text-[11px] text-canopy-muted">{inc.description}</p>}
                </div>
                <span className="shrink-0 font-mono text-canopy-green">
                  {inc.estimatedValue != null ? money(inc.estimatedValue) : '—'}
                </span>
              </div>
            ))}
          </div>
          {incentives.estimatedTotalIncentiveValue != null && (
            <div className="mt-3 flex items-center justify-between border-t border-canopy-border pt-2 text-sm">
              <span className="font-medium text-canopy-text">Estimated total</span>
              <span className="font-mono font-semibold text-canopy-green">
                {money(incentives.estimatedTotalIncentiveValue)}
              </span>
            </div>
          )}
          {incentives.notes && <p className="mt-2 text-[11px] text-canopy-muted">{incentives.notes}</p>}
        </div>
      </Section>

      {/* ── 10. AI advisor summary ── */}
      {dash.advisorSummary && (
        <Section icon={Bot} title="Canopy Advisor Summary">
          <div className="rounded-2xl border border-canopy-green/30 bg-gradient-to-b from-canopy-green/10 to-transparent p-4">
            <p className="text-sm leading-relaxed text-canopy-text">{dash.advisorSummary}</p>
          </div>
        </Section>
      )}

      {/* ── 11. Risks & tradeoffs ── */}
      {dash.risksAndTradeoffs.length > 0 && (
        <Section icon={TriangleAlert} title="Risks & Tradeoffs">
          <div className="space-y-2">
            {dash.risksAndTradeoffs.map((r, i) => (
              <div key={i} className={`rounded-xl border p-3 ${sevClasses(r.severity)}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-canopy-text">{r.title}</span>
                  <span className="shrink-0 rounded-full border border-current px-2 py-0.5 text-[10px] font-semibold">
                    {r.severity}
                  </span>
                </div>
                <p className="mt-1 text-xs text-canopy-muted">{r.explanation}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ── 12. Next steps ── */}
      {dash.nextSteps.length > 0 && (
        <Section icon={ListChecks} title="Next Steps">
          <div className="space-y-2">
            {dash.nextSteps.map((s, i) => (
              <div key={i} className="flex items-start gap-3 rounded-xl border border-canopy-border bg-canopy-bg p-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-canopy-green/15 font-mono text-xs font-semibold text-canopy-green">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-canopy-text">{s.step}</p>
                  <p className="text-xs text-canopy-muted">{s.description}</p>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* assumptions */}
      {dash.assumptions.length > 0 && (
        <details className="rounded-xl border border-canopy-border bg-canopy-bg p-3 text-xs text-canopy-muted">
          <summary className="cursor-pointer select-none">Assumptions & data sources</summary>
          <ul className="mt-2 list-disc space-y-1 pl-4">
            {dash.assumptions.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </details>
      )}

      <Button
        variant="outline"
        onClick={() => advanceTo('preferences')}
        className="h-11 w-full gap-2 border-canopy-border bg-canopy-bg text-canopy-text hover:bg-canopy-surface"
      >
        <ArrowLeft className="h-4 w-4" />
        Adjust Priorities
      </Button>
    </div>
  )
}
