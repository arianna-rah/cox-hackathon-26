'use client'

import { useState } from 'react'
import { DollarSign, TrendingUp, Leaf, Users, ArrowLeft, Play } from 'lucide-react'
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

  const [budget, setBudget] = useState(50000)
  const [sensitivity, setSensitivity] = useState(50) // 0 = impact, 100 = ROI
  const [goal, setGoal] = useState<UserPreferences['primaryGoal']>('savings')

  const run = () => {
    setPreferences({
      budgetDollars: budget,
      costSensitivity: sensitivity / 100,
      primaryGoal: goal,
    })
    advanceTo('analysis')
  }

  return (
    <div className="flex flex-col gap-7 p-5">
      {/* Budget */}
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
      </div>

      {/* Cost sensitivity */}
      <div>
        <label className="text-sm font-medium text-canopy-text">
          What matters more?
        </label>
        <Slider
          className="mt-3"
          value={[sensitivity]}
          min={0}
          max={100}
          step={1}
          onValueChange={(v) => setSensitivity(v[0])}
        />
        <div className="mt-1.5 flex justify-between text-[11px] text-canopy-muted">
          <span>🌍 Environmental impact</span>
          <span>⚡ Fastest payback</span>
        </div>
      </div>

      {/* Primary goal */}
      <div>
        <label className="mb-3 block text-sm font-medium text-canopy-text">
          Primary goal
        </label>
        <div className="grid grid-cols-2 gap-2.5">
          {GOALS.map((g) => {
            const active = goal === g.id
            return (
              <button
                key={g.id}
                onClick={() => setGoal(g.id)}
                className={`flex items-center gap-2 rounded-xl border px-3 py-3 text-sm font-medium transition-colors ${
                  active
                    ? 'border-canopy-green bg-canopy-green/15 text-canopy-green'
                    : 'border-canopy-border bg-canopy-bg text-canopy-muted hover:border-canopy-green/50 hover:text-canopy-text'
                }`}
              >
                <g.icon className="h-4 w-4" />
                {g.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="mt-2 flex gap-2.5">
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
          className="h-12 flex-[2] gap-2 bg-canopy-green text-base font-semibold text-canopy-bg hover:bg-canopy-green-dim"
        >
          <Play className="h-4 w-4" />
          Run Analysis
        </Button>
      </div>
    </div>
  )
}
