'use client'

import { Trophy, Sparkles, Users, ArrowLeft, TriangleAlert, Satellite } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { useMapStore } from '@/stores/mapStore'
import { useAnalysisStore } from '@/stores/analysisStore'
import type { Building, ScoredOption, UserPreferences } from '@/types'

function co2Tons(o: ScoredOption, b: Building): number {
  return o.co2TonsPerYear ?? (o.co2TonsPerSqFtPerYear ?? 0) * b.roofAreaSqFt
}

function fmtTons(t: number): string {
  return t >= 10 ? `${Math.round(t)}` : t.toFixed(1)
}

function whyThisRoof(o: ScoredOption, b: Building, p: UserPreferences, roofAreaSqFt: number): string {
  const age = b.yearBuilt < 1980 ? `the ${b.yearBuilt} structure` : `this ${b.yearBuilt} building`
  const roi = o.roiMonths < 900 ? `pays back in about ${o.roiMonths} months` : `delivers long-term value`
  const goal =
    p.primaryGoal === 'environment'
      ? 'maximizes environmental impact'
      : p.primaryGoal === 'revenue'
        ? 'generates new revenue'
        : p.primaryGoal === 'community'
          ? 'anchors a block-wide transformation'
          : 'cuts your operating costs'
  return `On ${roofAreaSqFt.toLocaleString()} sq ft of ${b.roofType.toLowerCase()} roof, ${o.name} fits ${age} (load OK at ${b.maxLoadPSF} lbs/sq ft), ${roi}, and ${goal}.`
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-canopy-border bg-canopy-bg p-3 text-center">
      <p className="font-mono text-lg font-bold text-canopy-text">{value}</p>
      <p className="mt-0.5 text-[10px] uppercase tracking-wide text-canopy-muted">
        {label}
      </p>
    </div>
  )
}

export function Results() {
  const result = useAnalysisStore((s) => s.result)
  const solar = useAnalysisStore((s) => s.solar)
  const advanceTo = useMapStore((s) => s.advanceTo)
  const showCommunity = useMapStore((s) => s.showCommunityLayer)
  const toggleCommunity = useMapStore((s) => s.toggleCommunityLayer)

  if (!result) return null
  const { building: b, preferences: p, rankedOptions, communityBonus: cb } = result
  const top = rankedOptions[0]
  const rest = rankedOptions.slice(1, 4)
  const roofAreaSqFt = solar?.roofAreaSqFt ?? b.roofAreaSqFt

  return (
    <div className="flex flex-col gap-5 p-5">
      {/* Live-data banner — the analysis used real Google Solar measurements */}
      {solar && (
        <div className="flex items-center gap-2 rounded-lg border border-canopy-green/30 bg-canopy-green/5 px-3 py-2 text-xs text-canopy-green">
          <Satellite className="h-3.5 w-3.5 shrink-0" />
          <span>
            Analysis used live Google Solar data · {roofAreaSqFt.toLocaleString()} ft² roof ·{' '}
            {solar.annualKwh.toLocaleString()} kWh/yr solar potential
          </span>
        </div>
      )}

      {/* Top recommendation */}
      <div className="rounded-2xl border border-canopy-green/40 bg-canopy-green/5 p-4">
        <div className="mb-2 flex items-center gap-2 text-canopy-green">
          <Trophy className="h-4 w-4" />
          <span className="text-xs font-mono uppercase tracking-widest">
            Top Recommendation
          </span>
        </div>
        <h3 className="text-xl font-bold text-canopy-text">{top.name}</h3>
        <p className="mt-1 text-sm text-canopy-muted">{top.shortDescription}</p>

        {top.isReal && (
          <div className="mt-3 flex items-center gap-1.5 text-xs text-canopy-green">
            <Satellite className="h-3.5 w-3.5" />
            <span>
              Live numbers from Google Solar
              {top.annualKwh ? ` · ${top.annualKwh.toLocaleString()} kWh/yr measured` : ''}
            </span>
          </div>
        )}

        <div className="mt-4 grid grid-cols-3 gap-2.5">
          <Metric label="Upfront" value={`$${Math.round(top.uptrontCost).toLocaleString()}`} />
          <Metric label="Payback" value={top.roiMonths < 900 ? `${top.roiMonths} mo` : '—'} />
          <Metric label="CO₂ / yr" value={`${fmtTons(co2Tons(top, b))} t`} />
        </div>

        {top.warningsForBuilding.length > 0 && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-canopy-amber/40 bg-canopy-amber/10 p-2.5 text-xs text-canopy-amber">
            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{top.warningsForBuilding[0]}</span>
          </div>
        )}

        <div className="mt-4">
          <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-canopy-green">
            <Sparkles className="h-3.5 w-3.5" /> Why this roof?
          </p>
          <p className="text-sm leading-relaxed text-canopy-text">
            {whyThisRoof(top, b, p, roofAreaSqFt)}
          </p>
        </div>

        {top.rebates.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {top.rebates.map((r) => (
              <Badge
                key={r}
                className="bg-canopy-green/15 text-[11px] font-normal text-canopy-green"
              >
                {r}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Other options */}
      <div>
        <p className="mb-2 text-xs font-mono uppercase tracking-widest text-canopy-muted">
          Other Options
        </p>
        <div className="space-y-1.5">
          {rest.map((o, i) => (
            <div
              key={o.id}
              className="flex items-center justify-between rounded-lg border border-canopy-border bg-canopy-bg px-3 py-2.5 text-sm"
            >
              <div className="flex items-center gap-2">
                <span className="font-mono text-canopy-muted">{i + 2}.</span>
                <span className="text-canopy-text">{o.name}</span>
                {!o.feasible && (
                  <TriangleAlert className="h-3.5 w-3.5 text-canopy-amber" />
                )}
              </div>
              <div className="flex items-center gap-3 font-mono text-xs text-canopy-muted">
                <span>${Math.round(o.uptrontCost).toLocaleString()}</span>
                <span>{o.roiMonths < 900 ? `${o.roiMonths} mo` : '—'}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Separator className="bg-canopy-border" />

      {/* Community aggregator */}
      <div className="rounded-2xl border border-canopy-green/30 bg-canopy-surface p-4">
        <div className="mb-3 flex items-center gap-2 text-canopy-green">
          <Users className="h-4 w-4" />
          <span className="text-xs font-mono uppercase tracking-widest">
            Community Aggregator
          </span>
        </div>

        <Button
          onClick={toggleCommunity}
          className={`mb-4 h-10 w-full font-semibold ${
            showCommunity
              ? 'bg-canopy-green-dim text-canopy-bg hover:bg-canopy-green'
              : 'bg-canopy-green text-canopy-bg hover:bg-canopy-green-dim'
          }`}
        >
          {showCommunity ? 'Hide Block Impact' : 'View Block Impact'}
        </Button>

        <div className="space-y-2 text-sm">
          <Row label="Neighbors on your block" value={`${cb.neighborCount}`} />
          <Row label="Bulk discount" value={`${Math.round(cb.bulkDiscountPct * 100)}%`} />
          <Row
            label="Pooled stormwater"
            value={`$${Math.round(cb.pooledStormwaterDollarsPerYear).toLocaleString()}/yr`}
          />
          <Row label="Heat reduction" value={`${cb.heatReductionF.toFixed(1)}°F`} />
          <div className="flex items-center justify-between border-t border-canopy-border pt-2">
            <span className="text-canopy-muted">City grant eligible</span>
            {cb.cityGrantEligible ? (
              <span className="font-mono font-semibold text-canopy-green">
                ${cb.cityGrantDollars.toLocaleString()} ✓
              </span>
            ) : (
              <span className="font-mono text-canopy-muted">Not yet</span>
            )}
          </div>
        </div>
      </div>

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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-canopy-muted">{label}</span>
      <span className="font-mono text-canopy-text">{value}</span>
    </div>
  )
}
