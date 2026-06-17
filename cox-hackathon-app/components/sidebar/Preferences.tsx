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
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { useMapStore } from '@/stores/mapStore'
import type { UserPreferences } from '@/types'

const GOALS: {
  id: UserPreferences['primaryGoal']
  label: string
  icon: typeof Leaf
}[] = [
  { id: 'savings', label: 'Cut Costs', icon: DollarSign },
  { id: 'revenue', label: 'Earn Revenue', icon: TrendingUp },
  { id: 'environment', label: 'Max Impact', icon: Leaf },
  { id: 'community', label: 'Community', icon: Users },
]

export function Preferences() {
  const advanceTo = useMapStore((s) => s.advanceTo)
  const setPreferences = useMapStore((s) => s.setPreferences)
  const building = useMapStore((s) => s.selectedBuilding)

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

  return (
    <div className="flex flex-col gap-6 p-5">
      {/* ── Budget ── */}
      <div>
        <div className="mb-3 flex items-baseline justify-between">
          <label className="text-sm font-medium text-greentop-text">Budget</label>
          <span className="font-mono text-lg font-semibold text-greentop-green">
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
        <div className="mt-1.5 flex justify-between text-[11px] text-greentop-muted">
          <span>$5k</span>
          <span>$300k</span>
        </div>
      </div>

      {/* ── Optional: actual energy use ── */}
      <div>
        <label className="text-sm font-medium text-greentop-text">
          Avg. monthly electric bill <span className="text-greentop-muted">(optional)</span>
        </label>
        <div className="mt-2 flex items-center rounded-xl border border-greentop-border bg-greentop-surface px-3 focus-within:border-greentop-green/60">
          <span className="text-greentop-muted">$</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={bill}
            onChange={(e) => setBill(e.target.value)}
            placeholder="e.g. 4200"
            className="w-full bg-transparent px-2 py-2.5 text-sm text-greentop-text placeholder:text-greentop-muted focus:outline-none"
          />
          <span className="text-xs text-greentop-muted">/mo</span>
        </div>
      </div>

      {/* ── Main priority tradeoff ── */}
      <div>
        <label className="text-sm font-medium text-greentop-text">What matters more?</label>
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
              sensitivity < 50 ? 'font-medium text-greentop-green' : 'text-greentop-muted'
            }`}
          >
            <Globe className="h-3.5 w-3.5" /> Environmental Impact
          </span>
          <span
            className={`inline-flex items-center gap-1 transition-colors ${
              sensitivity > 50 ? 'font-medium text-greentop-green' : 'text-greentop-muted'
            }`}
          >
            <Zap className="h-3.5 w-3.5" /> Fastest Payback
          </span>
        </div>
      </div>

      {/* ── Primary goal ── */}
      <div>
        <label className="mb-3 block text-sm font-medium text-greentop-text">Primary goal</label>
        <div className="grid grid-cols-2 gap-2.5">
          {GOALS.map((g) => {
            const active = goal === g.id
            return (
              <button
                key={g.id}
                onClick={() => setGoal(g.id)}
                className={`flex items-center gap-2 rounded-xl border p-3 text-left transition-colors ${
                  active
                    ? 'border-greentop-green bg-greentop-green/15 shadow-[0_0_0_1px_var(--color-greentop-green)]'
                    : 'border-greentop-border bg-greentop-surface hover:border-greentop-green/50'
                }`}
              >
                <g.icon className={`h-4 w-4 shrink-0 ${active ? 'text-greentop-green' : 'text-greentop-muted'}`} />
                <span
                  className={`text-sm font-semibold ${active ? 'text-greentop-green' : 'text-greentop-text'}`}
                >
                  {g.label}
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
        className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
          includeCommunity
            ? 'border-greentop-green/60 bg-greentop-green/10'
            : 'border-greentop-border bg-greentop-surface'
        }`}
      >
        <Users className={`h-4 w-4 shrink-0 ${includeCommunity ? 'text-greentop-green' : 'text-greentop-muted'}`} />
        <p className="flex-1 text-sm font-medium text-greentop-text">Include community benefits</p>
        <span
          aria-hidden
          className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
            includeCommunity ? 'bg-greentop-green' : 'bg-greentop-border'
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
      <div className="sticky bottom-0 -mx-5 -mb-5 mt-1 flex gap-2.5 border-t border-greentop-border bg-greentop-surface px-5 py-4">
        <Button
          variant="outline"
          onClick={() => advanceTo('info')}
          className="h-12 flex-1 gap-2 border-greentop-border bg-greentop-bg text-greentop-text hover:bg-greentop-surface"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <Button
          onClick={run}
          disabled={!building}
          className="h-12 flex-[2] gap-2 bg-greentop-green text-base font-semibold text-white hover:bg-greentop-green-dim disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Sparkles className="h-4 w-4" />
          Run Analysis
        </Button>
      </div>
    </div>
  )
}
