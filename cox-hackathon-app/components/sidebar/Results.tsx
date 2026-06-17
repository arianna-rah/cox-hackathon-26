'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Trophy,
  Sparkles,
  ArrowLeft,
  ArrowRight,
  Leaf,
  Zap,
  Droplets,
  Thermometer,
  Building2,
  Sun,
  TreePine,
  Flower2,
  ChevronDown,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useMapStore } from '@/stores/mapStore'
import { useAnalysisStore } from '@/stores/analysisStore'
import { useDashboardStore } from '@/stores/dashboardStore'
import { buildFallbackDashboard, buildFallbackPlan } from '@/lib/dashboard'
import { optionEnergyImpact, billToAnnualKwh } from '@/lib/scoring'
import type { DashboardAnalysis, DashRoofPlan } from '@/types'

// ── formatting ──
const money = (n: number | null | undefined) =>
  n == null ? '—' : `$${Math.round(n).toLocaleString()}`
const years = (n: number | null | undefined) => (n == null ? '—' : `${n} yr`)
const pct = (n: number | null | undefined) => (n == null ? '—' : `${n}%`)
const tons = (n: number | null | undefined) => (n == null ? '—' : `${n} t`)

// Per-option icon + accent colour, shared in spirit with the 3D roof widgets.
const OPTION_META: Record<string, { icon: typeof Leaf; color: string }> = {
  'cool-roof': { icon: Sun, color: '#0284c7' },
  solar: { icon: Zap, color: '#d97706' },
  'green-roof-extensive': { icon: Leaf, color: '#16a34a' },
  'green-roof-intensive': { icon: TreePine, color: '#15803d' },
  rainwater: { icon: Droplets, color: '#0369a1' },
  beekeeping: { icon: Flower2, color: '#ca8a04' },
}
const metaFor = (id: string) => OPTION_META[id] ?? { icon: Leaf, color: '#16a34a' }

const UNUSABLE_COLOR = '#b8ab90'

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
      <p className="mb-2 flex items-center gap-1.5 text-xs font-mono uppercase tracking-widest text-greentop-muted">
        <Icon className="h-3.5 w-3.5 text-greentop-green" />
        {title}
      </p>
      {children}
    </div>
  )
}

function Metric({ label, value, good }: { label: string; value: string; good?: boolean }) {
  return (
    <div className="rounded-xl border border-greentop-border bg-greentop-surface p-3">
      <p className={`font-mono text-base font-bold ${good ? 'text-greentop-green' : 'text-greentop-text'}`}>
        {value}
      </p>
      <p className="mt-0.5 text-[10px] uppercase tracking-wide text-greentop-muted">{label}</p>
    </div>
  )
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-greentop-muted">{label}</span>
      <span className={`font-mono ${strong ? 'font-semibold text-greentop-green' : 'text-greentop-text'}`}>
        {value}
      </span>
    </div>
  )
}

/** Stacked bar of how the roof is allocated: each component + the unusable share. */
function RoofAllocation({ plan }: { plan: DashRoofPlan }) {
  // Catchment options (rainwater) don't occupy roof surface, so they're noted
  // separately rather than stacked into the surface allocation.
  const surface = plan.components.filter((c) => c.optionId !== 'rainwater')
  const segs = [
    ...surface.map((c) => ({ label: c.name, pctRaw: c.coveragePct, color: metaFor(c.optionId).color })),
    { label: 'Unusable', pctRaw: plan.unusablePct, color: UNUSABLE_COLOR },
  ]
  const total = segs.reduce((s, x) => s + x.pctRaw, 0) || 1

  return (
    <div className="rounded-xl border border-greentop-border bg-greentop-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-medium text-greentop-text">Roof allocation</span>
        <span className="font-mono text-sm font-semibold text-greentop-green">
          {plan.changeablePct}% usable
        </span>
      </div>
      <div className="flex h-3 w-full overflow-hidden rounded-full">
        {segs.map((s, i) => (
          <div key={i} style={{ width: `${(s.pctRaw / total) * 100}%`, backgroundColor: s.color }} />
        ))}
      </div>
      <div className="mt-3 space-y-1.5">
        {segs.map((s, i) => (
          <div key={i} className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-greentop-text">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
              {s.label}
            </span>
            <span className="font-mono text-greentop-muted">{s.pctRaw}%</span>
          </div>
        ))}
      </div>
      {plan.unusableReason && (
        <p className="mt-2 text-[11px] leading-snug text-greentop-muted">{plan.unusableReason}</p>
      )}
    </div>
  )
}

export function Results() {
  const storedDash = useAnalysisStore((s) => s.dashboardAnalysis)
  const result = useAnalysisStore((s) => s.result)
  const solar = useAnalysisStore((s) => s.solar)
  // Shared with the 3D scene: which roof widget is focused. Either side can set it.
  const selectedOptionId = useAnalysisStore((s) => s.selectedOptionId)
  const setSelectedOptionId = useAnalysisStore((s) => s.setSelectedOptionId)
  const advanceTo = useMapStore((s) => s.advanceTo)
  const addPlan = useDashboardStore((s) => s.addPlan)
  const router = useRouter()

  const selectedRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    selectedRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [selectedOptionId])

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

  const m = dash.keyMetrics
  const env = dash.environmentalImpact
  // Always have a plan: prefer the stored one, else derive deterministically.
  const plan: DashRoofPlan =
    dash.plan ??
    (result ? buildFallbackPlan(result.building, result.rankedOptions, solar, result.preferences) : null) ?? {
      strategyName: dash.recommendedOption.name,
      summary: dash.recommendedOption.shortHeadline,
      components: [],
      changeablePct: 100,
      unusablePct: 0,
      unusableReason: '',
    }

  // Energy box is specific to the plan's primary (first) component.
  const primaryId = plan.components[0]?.optionId
  const recOption =
    result?.rankedOptions.find((o) => o.id === primaryId) ?? result?.rankedOptions[0] ?? null
  const overrideKwh = result?.preferences.monthlyElectricBill
    ? billToAnnualKwh(result.preferences.monthlyElectricBill)
    : null
  const energy = result ? optionEnergyImpact(result.building, recOption, solar, overrideKwh) : null
  const usableAreaPct = solar?.roofCoveragePct ?? plan.changeablePct
  // No surface retrofit is feasible — show the verdict, not financial metrics.
  const nothingDoable = plan.components.length === 0

  return (
    <div className="flex flex-col gap-5 p-5">
      {/* ── 1. Recommended strategy ── */}
      <div className="rounded-2xl border border-greentop-green/40 bg-greentop-green/5 p-4">
        <div className="mb-2 flex items-center gap-2 text-greentop-green">
          <Trophy className="h-4 w-4" />
          <span className="text-xs font-mono uppercase tracking-widest">Recommended strategy</span>
        </div>
        <h3 className="text-xl font-bold text-greentop-text">{plan.strategyName}</h3>
        {plan.summary && (
          <p className="mt-1.5 flex items-start gap-1.5 text-sm leading-relaxed text-greentop-text">
            <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-greentop-green" />
            {plan.summary}
          </p>
        )}

        {!nothingDoable && (
          <div className="mt-4 grid grid-cols-3 gap-2.5">
            <Metric label="Upfront" value={money(m.upfrontCost)} />
            <Metric label="Payback" value={years(m.paybackYears)} />
            <Metric label="CO₂ / yr" value={tons(m.co2ReductionPerYear)} good />
          </div>
        )}
      </div>

      {/* ── 2. Roof allocation (how much becomes what, in %) ── */}
      <RoofAllocation plan={plan} />

      {/* ── 3. Key metrics ── */}
      {!nothingDoable && (
        <Section icon={Trophy} title="Key Metrics">
          <div className="grid grid-cols-2 gap-2.5">
            <Metric label="Upfront cost" value={money(m.upfrontCost)} />
            <Metric label="Net after incentives" value={money(m.netCostAfterIncentives)} good />
            <Metric label="Annual savings" value={`${money(m.annualSavings)}/yr`} good />
            <Metric label="Payback" value={years(m.paybackYears)} />
            <Metric label="ROI" value={pct(m.roiPercent)} good />
            <Metric label="CO₂ / yr" value={tons(m.co2ReductionPerYear)} good />
          </div>
        </Section>
      )}

      {/* ── 4. Energy & roof use ── */}
      {!nothingDoable && energy && (
        <Section icon={Zap} title="Energy & Roof Use">
          <div className="rounded-xl border border-greentop-green/30 bg-greentop-green/5 p-4">
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
                  <span className="flex items-center gap-1.5 text-greentop-muted">
                    <Zap className="h-3 w-3 text-greentop-green" />
                    {energy.kind === 'production' ? 'Covers your electricity' : 'Cuts your electricity use'}
                  </span>
                  <span className="font-mono font-semibold text-greentop-green">{energy.offsetPct}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-greentop-border">
                  <div className="h-full rounded-full bg-greentop-green" style={{ width: `${energy.offsetPct}%` }} />
                </div>
              </div>
            )}

            {/* Solar potential + usable roof area (%), folded in from feasibility */}
            <div className="mt-3 space-y-1.5 border-t border-greentop-border pt-3 text-sm">
              {solar && (
                <Row label="Solar potential" value={`${solar.annualKwh.toLocaleString()} kWh/yr`} />
              )}
              <Row label="Usable roof area" value={`${Math.round(usableAreaPct)}%`} strong />
            </div>
          </div>
        </Section>
      )}

      {/* ── 5. Environmental impact ── */}
      {!nothingDoable && (
      <Section icon={Leaf} title="Environmental Impact">
        <div className="rounded-xl border border-greentop-green/30 bg-greentop-green/5 p-4">
          <div className="grid grid-cols-2 gap-2.5">
            <Metric label="CO₂ avoided / yr" value={tons(env.co2ReductionPerYear)} good />
            <Metric label="20-yr CO₂ avoided" value={tons(env.lifetimeCo2Reduction)} good />
          </div>
          {env.plainEnglishEquivalent && (
            <p className="mt-3 flex items-start gap-1.5 text-sm text-greentop-text">
              <Leaf className="mt-0.5 h-3.5 w-3.5 shrink-0 text-greentop-green" />
              {env.plainEnglishEquivalent}
            </p>
          )}
          <div className="mt-3 space-y-1.5 text-xs text-greentop-muted">
            {env.stormwaterBenefit && (
              <p className="flex items-start gap-1.5">
                <Droplets className="mt-0.5 h-3 w-3 shrink-0 text-greentop-green" />
                {env.stormwaterBenefit}
              </p>
            )}
            {env.heatIslandBenefit && (
              <p className="flex items-start gap-1.5">
                <Thermometer className="mt-0.5 h-3 w-3 shrink-0 text-greentop-green" />
                {env.heatIslandBenefit}
              </p>
            )}
          </div>
        </div>
      </Section>
      )}

      {/* ── 6. Plan components — clickable widgets, expand for implementation ── */}
      {plan.components.length > 0 && (
        <Section icon={Building2} title="What goes on the roof">
          <div className="space-y-1.5">
            {plan.components.map((c) => {
              const meta = metaFor(c.optionId)
              const Icon = meta.icon
              const open = selectedOptionId === c.optionId
              return (
                <div
                  key={c.optionId}
                  className={`overflow-hidden rounded-xl border transition-colors ${
                    open ? 'border-greentop-green bg-greentop-green/5' : 'border-greentop-border bg-greentop-surface'
                  }`}
                >
                  <button
                    type="button"
                    ref={open ? selectedRef : undefined}
                    onClick={() => setSelectedOptionId(open ? null : c.optionId)}
                    className="flex w-full items-center gap-3 p-3 text-left"
                  >
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                      style={{ backgroundColor: meta.color }}
                    >
                      <Icon className="h-4 w-4 text-white" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-greentop-text">{c.name}</span>
                      <span className="block text-xs text-greentop-muted">{c.annualBenefit}</span>
                    </span>
                    <span className="shrink-0 rounded-full bg-greentop-bg px-2 py-0.5 font-mono text-[11px] text-greentop-green">
                      {c.coveragePct}%
                    </span>
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-greentop-muted transition-transform ${open ? 'rotate-180' : ''}`}
                    />
                  </button>
                  {open && (
                    <div className="border-t border-greentop-border px-3 pb-3 pt-2">
                      <div className="mb-2 grid grid-cols-2 gap-2">
                        <Metric label="Roof used" value={`${c.coveragePct}%`} />
                        <Metric label="Upfront" value={money(c.upfrontCost)} />
                      </div>
                      <p className="text-sm leading-relaxed text-greentop-text">{c.implementation}</p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </Section>
      )}

      {/* ── Save to my dashboard ── */}
      {result && !nothingDoable && (
        <Button
          onClick={() => {
            const selectedOption =
              (selectedOptionId
                ? result.rankedOptions.find((o) => o.id === selectedOptionId)
                : null) ??
              result.rankedOptions.find((o) => o.id === plan.components[0]?.optionId) ??
              result.rankedOptions[0]
            if (!selectedOption) return
            // Rebuild the dashboard with the user's chosen option ranked first
            // so all saved content (metrics, copy, plan) reflects that choice,
            // not whatever ranked #1 in the original analysis.
            const reranked = [
              selectedOption,
              ...result.rankedOptions.filter((o) => o.id !== selectedOption.id),
            ]
            const planDashboard = buildFallbackDashboard(
              result.building,
              result.preferences,
              reranked,
              result.communityBonus,
              solar,
            )
            const planId = addPlan({
              building: result.building,
              selectedOption,
              dashboard: planDashboard,
              solar,
            })
            router.push(`/plan/${planId}`)
          }}
          className="h-12 w-full gap-2 bg-greentop-green text-base font-semibold text-white hover:bg-greentop-green-dim"
        >
          Build My Plan
          <ArrowRight className="h-4 w-4" />
        </Button>
      )}

      <Button
        variant="outline"
        onClick={() => advanceTo('preferences')}
        className="h-11 w-full gap-2 border-greentop-border bg-greentop-bg text-greentop-text hover:bg-greentop-surface"
      >
        <ArrowLeft className="h-4 w-4" />
        Adjust Priorities
      </Button>
    </div>
  )
}
