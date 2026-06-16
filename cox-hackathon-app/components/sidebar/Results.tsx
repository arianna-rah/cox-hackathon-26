'use client'

import { useEffect, useRef } from 'react'
import { Trophy, Sparkles, Users, ArrowLeft, TriangleAlert, Satellite, ChevronDown } from 'lucide-react'
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

/** Full detail card — shown for whichever option is currently selected,
 * whether that selection came from clicking it here or clicking its widget
 * on the 3D roof. */
function OptionCard({
  o,
  isTop,
  b,
  p,
  roofAreaSqFt,
}: {
  o: ScoredOption
  isTop: boolean
  b: Building
  p: UserPreferences
  roofAreaSqFt: number
}) {
  return (
    <div className="rounded-2xl border-2 border-canopy-green/50 bg-canopy-green/5 p-4 shadow-[0_0_0_3px_rgba(34,197,94,0.08)]">
      <div className="mb-2 flex items-center gap-2 text-canopy-green">
        <Trophy className="h-4 w-4" />
        <span className="text-xs font-mono uppercase tracking-widest">
          {isTop ? 'Top Recommendation' : 'Selected Option'}
        </span>
      </div>
      <h3 className="text-xl font-bold text-canopy-text">{o.name}</h3>
      <p className="mt-1 text-sm text-canopy-muted">{o.shortDescription}</p>

      {o.isReal && (
        <div className="mt-3 flex items-center gap-1.5 text-xs text-canopy-green">
          <Satellite className="h-3.5 w-3.5" />
          <span>
            Live numbers from Google Solar
            {o.annualKwh ? ` · ${o.annualKwh.toLocaleString()} kWh/yr measured` : ''}
          </span>
        </div>
      )}

      <div className="mt-4 grid grid-cols-3 gap-2.5">
        <Metric label="Upfront" value={`$${Math.round(o.uptrontCost).toLocaleString()}`} />
        <Metric label="Payback" value={o.roiMonths < 900 ? `${o.roiMonths} mo` : '—'} />
        <Metric label="CO₂ / yr" value={`${fmtTons(co2Tons(o, b))} t`} />
      </div>

      {o.warningsForBuilding.length > 0 && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-canopy-amber/40 bg-canopy-amber/10 p-2.5 text-xs text-canopy-amber">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{o.warningsForBuilding[0]}</span>
        </div>
      )}

      <div className="mt-4">
        <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-canopy-green">
          <Sparkles className="h-3.5 w-3.5" /> Why this roof?
        </p>
        <p className="text-sm leading-relaxed text-canopy-text">
          {whyThisRoof(o, b, p, roofAreaSqFt)}
        </p>
      </div>

      {o.rebates.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {o.rebates.map((r) => (
            <Badge key={r} className="bg-canopy-green/15 text-[11px] font-normal text-canopy-green">
              {r}
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}

export function Results() {
  const result = useAnalysisStore((s) => s.result)
  const solar = useAnalysisStore((s) => s.solar)
  const selectedOptionId = useAnalysisStore((s) => s.selectedOptionId)
  const setSelectedOptionId = useAnalysisStore((s) => s.setSelectedOptionId)
  const advanceTo = useMapStore((s) => s.advanceTo)
  const showCommunity = useMapStore((s) => s.showCommunityLayer)
  const toggleCommunity = useMapStore((s) => s.toggleCommunityLayer)
  const selectedRef = useRef<HTMLDivElement>(null)

  // Whenever the selection changes (including from clicking a widget on the
  // 3D roof), scroll its card into view so the link feels alive.
  useEffect(() => {
    selectedRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [selectedOptionId])

  if (!result) return null
  const { building: b, preferences: p, rankedOptions, communityBonus: cb } = result
  const roofAreaSqFt = solar?.roofAreaSqFt ?? b.roofAreaSqFt
  const options = rankedOptions.slice(0, 4)
  const selected = options.find((o) => o.id === selectedOptionId) ?? options[0]

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

      {/* Selected option — full detail. Clicking a widget on the 3D roof
       * expands the matching card here; this is whichever option is
       * currently linked, defaulting to the top pick. */}
      <div ref={selectedRef}>
        <OptionCard o={selected} isTop={selected.id === options[0].id} b={b} p={p} roofAreaSqFt={roofAreaSqFt} />
      </div>

      {/* Other options — click one to expand it above and highlight its
       * matching widget on the roof. */}
      <div>
        <p className="mb-2 text-xs font-mono uppercase tracking-widest text-canopy-muted">
          Other Options
        </p>
        <div className="space-y-1.5">
          {options
            .filter((o) => o.id !== selected.id)
            .map((o) => {
              const rank = options.findIndex((opt) => opt.id === o.id) + 1
              return (
                <button
                  type="button"
                  key={o.id}
                  onClick={() => setSelectedOptionId(o.id)}
                  className="flex w-full items-center justify-between rounded-lg border border-canopy-border bg-canopy-bg px-3 py-2.5 text-left text-sm transition-colors hover:border-canopy-green/50 hover:bg-canopy-green/5"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-canopy-muted">{rank}.</span>
                    <span className="text-canopy-text">{o.name}</span>
                    {!o.feasible && (
                      <TriangleAlert className="h-3.5 w-3.5 text-canopy-amber" />
                    )}
                  </div>
                  <div className="flex items-center gap-3 font-mono text-xs text-canopy-muted">
                    <span>${Math.round(o.uptrontCost).toLocaleString()}</span>
                    <span>{o.roiMonths < 900 ? `${o.roiMonths} mo` : '—'}</span>
                    <ChevronDown className="h-3.5 w-3.5" />
                  </div>
                </button>
              )
            })}
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
