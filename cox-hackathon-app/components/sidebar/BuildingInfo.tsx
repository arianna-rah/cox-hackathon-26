'use client'

import {
  Ruler,
  Layers,
  Weight,
  Sun,
  Thermometer,
  Droplets,
  ArrowRight,
  TriangleAlert,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useMapStore } from '@/stores/mapStore'
import type { Building } from '@/types'

/** Rough annual "hidden cost" of leaving the roof as-is. */
function hiddenCosts(b: Building) {
  const cooling = Math.round(b.heatIslandIntensityF * b.roofAreaSqFt * 0.04)
  const maintenance = Math.round(b.roofAreaSqFt * 0.11)
  const stormwater = Math.round(b.annualStormwaterCreditDollars)
  return { cooling, maintenance, stormwater, total: cooling + maintenance + stormwater }
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Ruler
  label: string
  value: string
}) {
  return (
    <div className="rounded-xl border border-canopy-border bg-canopy-bg p-3">
      <div className="mb-1 flex items-center gap-1.5 text-canopy-muted">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-[11px] uppercase tracking-wide">{label}</span>
      </div>
      <p className="font-mono text-sm font-semibold text-canopy-text">{value}</p>
    </div>
  )
}

export function BuildingInfo() {
  const b = useMapStore((s) => s.selectedBuilding)
  const advanceTo = useMapStore((s) => s.advanceTo)
  if (!b) return null

  const costs = hiddenCosts(b)
  const prewar = b.yearBuilt < 1980

  return (
    <div className="flex flex-col gap-5 p-5">
      <div>
        <div className="mb-2 flex items-center gap-2">
          <Badge className="bg-canopy-green/15 text-canopy-green capitalize">
            {b.buildingType}
          </Badge>
          <Badge
            variant="outline"
            className="border-canopy-border text-canopy-muted"
          >
            Built {b.yearBuilt}
          </Badge>
        </div>
        <h3 className="text-lg font-semibold leading-tight text-canopy-text">
          {b.name}
        </h3>
        <p className="text-sm text-canopy-muted">{b.address}</p>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <Stat icon={Ruler} label="Roof Area" value={`${b.roofAreaSqFt.toLocaleString()} ft²`} />
        <Stat icon={Layers} label="Roof" value={`${b.roofType} · ${b.roofMaterial}`} />
        <Stat icon={Weight} label="Max Load" value={`${b.maxLoadPSF} lbs/ft²`} />
        <Stat icon={Sun} label="Sun Exposure" value={`${b.sunExposureHrsPerDay} hrs/day`} />
        <Stat icon={Thermometer} label="Heat Island" value={`+${b.heatIslandIntensityF}°F`} />
        <Stat icon={Droplets} label="Stormwater" value={`$${b.annualStormwaterCreditDollars.toLocaleString()}/yr`} />
      </div>

      {prewar && (
        <div className="flex items-start gap-2 rounded-xl border border-canopy-amber/40 bg-canopy-amber/10 p-3 text-sm text-canopy-amber">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Pre-1980 construction — heavier rooftop systems may need a
            structural review.
          </span>
        </div>
      )}

      <div className="rounded-xl border border-canopy-red/30 bg-canopy-red/5 p-4">
        <p className="mb-3 text-xs font-mono uppercase tracking-widest text-canopy-red">
          What this roof costs you today
        </p>
        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between text-canopy-muted">
            <span>Excess cooling load</span>
            <span className="font-mono text-canopy-text">${costs.cooling.toLocaleString()}/yr</span>
          </div>
          <div className="flex justify-between text-canopy-muted">
            <span>Stormwater fees forgone</span>
            <span className="font-mono text-canopy-text">${costs.stormwater.toLocaleString()}/yr</span>
          </div>
          <div className="flex justify-between text-canopy-muted">
            <span>Roof maintenance overhead</span>
            <span className="font-mono text-canopy-text">${costs.maintenance.toLocaleString()}/yr</span>
          </div>
          <div className="mt-2 flex justify-between border-t border-canopy-border pt-2 font-semibold">
            <span className="text-canopy-text">Total hidden cost</span>
            <span className="font-mono text-canopy-red">${costs.total.toLocaleString()}/yr</span>
          </div>
        </div>
      </div>

      <Button
        onClick={() => advanceTo('preferences')}
        className="h-12 w-full gap-2 bg-canopy-green text-base font-semibold text-canopy-bg hover:bg-canopy-green-dim"
      >
        Analyze My Roof
        <ArrowRight className="h-4 w-4" />
      </Button>
    </div>
  )
}
