'use client'

import { useState } from 'react'
import {
  DollarSign,
  TrendingUp,
  Leaf,
  Users,
  ArrowLeft,
  Sparkles,
  Globe,
  Zap,
  MapPin,
  Sun,
  Ruler,
  Check,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { useMapStore } from '@/stores/mapStore'
import { useAnalysisStore } from '@/stores/analysisStore'
import type { UserPreferences } from '@/types'

const GOALS: {
  id: UserPreferences['primaryGoal']
  label: string
  description: string
  icon: typeof Leaf
}[] = [
  { id: 'savings', label: 'Cut Costs', description: 'Lower utility or operating expenses.', icon: DollarSign },
  { id: 'revenue', label: 'Earn Revenue', description: 'Generate value from unused roof space.', icon: TrendingUp },
  { id: 'environment', label: 'Max Impact', description: 'Reduce emissions, heat, and runoff.', icon: Leaf },
  { id: 'community', label: 'Community', description: 'Unlock block-level grants and shared benefits.', icon: Users },
]

/** Compact kWh/yr label: 5,280,000 → "5.3M", 138,000 → "138k". */
function fmtKwh(kwh: number): string {
  if (kwh >= 1_000_000) return `${(kwh / 1_000_000).toFixed(1)}M kWh/yr`
  return `${Math.round(kwh / 1000).toLocaleString()}k kWh/yr`
}

/** One compact read-only roof stat in the summary card. */
function RoofStat({
  icon: Icon,
  label,
  value,
  loading,
}: {
  icon: typeof Sun
  label: string
  value: string
  loading?: boolean
}) {
  return (
    <div className="rounded-lg border border-canopy-border bg-canopy-surface/60 px-2 py-2 text-center">
      <Icon className="mx-auto h-3.5 w-3.5 text-canopy-green" />
      <p className="mt-1 font-mono text-xs font-semibold text-canopy-text">
        {loading ? '…' : value}
      </p>
      <p className="text-[9px] uppercase tracking-wide text-canopy-muted">{label}</p>
    </div>
  )
}

export function Preferences() {
  const advanceTo = useMapStore((s) => s.advanceTo)
  const setPreferences = useMapStore((s) => s.setPreferences)
  const closeSidebar = useMapStore((s) => s.closeSidebar)
  const building = useMapStore((s) => s.selectedBuilding)
  const solar = useAnalysisStore((s) => s.solar)
  const solarLoading = useAnalysisStore((s) => s.solarLoading)

  const [budget, setBudget] = useState(50000)
  const [sensitivity, setSensitivity] = useState(50) // 0 = impact, 100 = payback
  const [goal, setGoal] = useState<UserPreferences['primaryGoal']>('savings')
  const [includeCommunity, setIncludeCommunity] = useState(true)
  const [bill, setBill] = useState('') // optional avg monthly electric bill ($)

  const run = () => {
    if (!building) return
    const billNum = parseFloat(bill)
    setPreferences({
      budgetDollars: budget,
      costSensitivity: sensitivity / 100,
      primaryGoal: goal,
      includeCommunity,
      monthlyElectricBill: Number.isFinite(billNum) && billNum > 0 ? billNum : null,
    })
    advanceTo('analysis')
  }

  const roofAreaSqFt = solar?.roofAreaSqFt ?? building?.roofAreaSqFt ?? null
  const sunHrs = solar?.sunExposureHrsPerDay ?? building?.sunExposureHrsPerDay ?? null
  const statLoading = solarLoading && !solar

  return (
    <div className="flex flex-col gap-5 p-5">
      {/* ── Selected roof summary (read-only) ── */}
      <div className="rounded-2xl border border-canopy-border bg-canopy-bg/60 p-4">
        <div className="mb-2.5 flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-canopy-green/15 px-2 py-0.5 text-[11px] font-medium text-canopy-green">
            <Check className="h-3 w-3" /> Roof selected
          </span>
          <button
            onClick={closeSidebar}
            className="text-xs text-canopy-muted underline-offset-2 transition-colors hover:text-canopy-green hover:underline"
          >
            Change roof
          </button>
        </div>

        <div className="flex items-start gap-2">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-canopy-green" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-canopy-text">
              {building?.name ?? 'Selected rooftop'}
            </p>
            <p className="truncate text-xs text-canopy-muted">{building?.address ?? '—'}</p>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <RoofStat
            icon={Ruler}
            label="Roof area"
            value={roofAreaSqFt ? `${roofAreaSqFt.toLocaleString()} ft²` : '—'}
            loading={statLoading}
          />
          <RoofStat
            icon={Sun}
            label="Sunlight"
            value={sunHrs ? `${sunHrs} hrs/day` : '—'}
            loading={statLoading}
          />
          <RoofStat
            icon={Zap}
            label="Solar"
            value={solar ? fmtKwh(solar.annualKwh) : '—'}
            loading={statLoading}
          />
        </div>
      </div>

      {/* ── Budget ── */}
      <div>
        <div className="mb-3 flex items-baseline justify-between">
          <label className="text-sm font-medium text-canopy-text">Budget</label>
          <span className="font-mono text-lg font-semibold text-canopy-green">
            ${budget.toLocaleString()}
          </span>
        </div>
        <Slider
          value={[budget]}
          min={5000}
          max={300000}
          step={5000}
          onValueChange={(v) => setBudget(v[0])}
        />
        <div className="mt-1.5 flex justify-between text-[11px] text-canopy-muted">
          <span>$5k</span>
          <span>$300k</span>
        </div>
        <p className="mt-2 text-[11px] text-canopy-muted">
          We&apos;ll prioritize options within or near your budget.
        </p>
      </div>

      {/* ── Optional: actual energy use ── */}
      <div>
        <label className="text-sm font-medium text-canopy-text">
          Avg. monthly electric bill <span className="text-canopy-muted">(optional)</span>
        </label>
        <div className="mt-2 flex items-center rounded-xl border border-canopy-border bg-canopy-bg px-3 focus-within:border-canopy-green/60">
          <span className="text-canopy-muted">$</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={bill}
            onChange={(e) => setBill(e.target.value)}
            placeholder="e.g. 4200"
            className="w-full bg-transparent px-2 py-2.5 text-sm text-canopy-text placeholder:text-canopy-muted focus:outline-none"
          />
          <span className="text-xs text-canopy-muted">/mo</span>
        </div>
        <p className="mt-1.5 text-[11px] text-canopy-muted">
          Makes energy savings exact. Leave blank and we estimate from building size.
        </p>
      </div>

      {/* ── Main priority tradeoff ── */}
      <div>
        <label className="text-sm font-medium text-canopy-text">What matters more?</label>
        <Slider
          className="mt-3"
          value={[sensitivity]}
          min={0}
          max={100}
          step={1}
          onValueChange={(v) => setSensitivity(v[0])}
        />
        <div className="mt-2 flex justify-between text-[11px]">
          <span
            className={`inline-flex items-center gap-1 transition-colors ${
              sensitivity < 50 ? 'font-medium text-canopy-green' : 'text-canopy-muted'
            }`}
          >
            <Globe className="h-3.5 w-3.5" /> Environmental Impact
          </span>
          <span
            className={`inline-flex items-center gap-1 transition-colors ${
              sensitivity > 50 ? 'font-medium text-canopy-green' : 'text-canopy-muted'
            }`}
          >
            <Zap className="h-3.5 w-3.5" /> Fastest Payback
          </span>
        </div>
      </div>

      {/* ── Primary goal ── */}
      <div>
        <label className="mb-3 block text-sm font-medium text-canopy-text">Primary goal</label>
        <div className="grid grid-cols-2 gap-2.5">
          {GOALS.map((g) => {
            const active = goal === g.id
            return (
              <button
                key={g.id}
                onClick={() => setGoal(g.id)}
                className={`flex flex-col items-start gap-1.5 rounded-xl border p-3 text-left transition-colors ${
                  active
                    ? 'border-canopy-green bg-canopy-green/15 shadow-[0_0_0_1px_var(--color-canopy-green)]'
                    : 'border-canopy-border bg-canopy-bg hover:border-canopy-green/50'
                }`}
              >
                <g.icon
                  className={`h-4 w-4 ${active ? 'text-canopy-green' : 'text-canopy-muted'}`}
                />
                <span
                  className={`text-sm font-semibold ${active ? 'text-canopy-green' : 'text-canopy-text'}`}
                >
                  {g.label}
                </span>
                <span className="text-[11px] leading-snug text-canopy-muted">
                  {g.description}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Community participation ── */}
      <button
        type="button"
        onClick={() => setIncludeCommunity((v) => !v)}
        className={`flex items-start gap-3 rounded-xl border p-3 text-left transition-colors ${
          includeCommunity
            ? 'border-canopy-green/60 bg-canopy-green/10'
            : 'border-canopy-border bg-canopy-bg'
        }`}
      >
        <Users
          className={`mt-0.5 h-4 w-4 shrink-0 ${
            includeCommunity ? 'text-canopy-green' : 'text-canopy-muted'
          }`}
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-canopy-text">Include community benefits?</p>
          <p className="mt-0.5 text-[11px] leading-snug text-canopy-muted">
            Show how results improve if nearby rooftops join a Green Block plan.
          </p>
        </div>
        <span
          aria-hidden
          className={`relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors ${
            includeCommunity ? 'bg-canopy-green' : 'bg-canopy-border'
          }`}
        >
          <span
            className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
              includeCommunity ? 'translate-x-[1.125rem]' : 'translate-x-0.5'
            }`}
          />
        </span>
      </button>

      {/* ── Actions ── */}
      <div className="sticky bottom-0 -mx-5 -mb-5 mt-1 flex gap-2.5 border-t border-canopy-border bg-canopy-surface px-5 py-4">
        <Button
          variant="outline"
          onClick={() => advanceTo('info')}
          className="h-12 flex-1 gap-2 border-canopy-border bg-canopy-bg text-canopy-text hover:bg-canopy-surface"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <Button
          onClick={run}
          disabled={!building}
          className="h-12 flex-[2] gap-2 bg-canopy-green text-base font-semibold text-canopy-bg hover:bg-canopy-green-dim disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Sparkles className="h-4 w-4" />
          Run Analysis
        </Button>
      </div>
    </div>
  )
}
