'use client'

import { useState } from 'react'
import {
  Ruler,
  Layers,
  Weight,
  Sun,
  Thermometer,
  Droplets,
  ArrowRight,
  TriangleAlert,
  Pencil,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useMapStore } from '@/stores/mapStore'
import { useAnalysisStore } from '@/stores/analysisStore'
import type { Building } from '@/types'

/** Rough annual "hidden cost" of leaving the roof as-is (modelled estimate). */
function hiddenCosts(b: Building, roofAreaSqFt: number) {
  const cooling = Math.round(b.heatIslandIntensityF * roofAreaSqFt * 0.04)
  const maintenance = Math.round(roofAreaSqFt * 0.11)
  const stormwater = Math.round(b.annualStormwaterCreditDollars)
  return { cooling, maintenance, stormwater, total: cooling + maintenance + stormwater }
}

/**
 * A single editable building/roof figure. Tap the value to type a new one —
 * Google Solar data can be stale, so the owner can correct it, and the edited
 * number is what flows into the analysis.
 */
function EditableStat({
  icon: Icon,
  label,
  value,
  suffix,
  onCommit,
}: {
  icon: typeof Ruler
  label: string
  value: number
  suffix: string
  onCommit: (n: number) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(value))

  function commit() {
    const n = Number(draft.replace(/[^0-9.]/g, ''))
    if (Number.isFinite(n) && n >= 0) onCommit(n)
    else setDraft(String(value))
    setEditing(false)
  }

  return (
    <div className="rounded-xl border border-greentop-border bg-greentop-surface p-3">
      <div className="mb-1 flex items-center justify-between text-greentop-muted">
        <span className="flex items-center gap-1.5">
          <Icon className="h-3.5 w-3.5" />
          <span className="text-[11px] uppercase tracking-wide">{label}</span>
        </span>
        {!editing && <Pencil className="h-3 w-3 opacity-50" />}
      </div>
      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit()
            if (e.key === 'Escape') {
              setDraft(String(value))
              setEditing(false)
            }
          }}
          className="w-full rounded-md border border-greentop-green/50 bg-greentop-bg px-1.5 py-0.5 font-mono text-sm font-semibold text-greentop-text outline-none"
        />
      ) : (
        <button
          type="button"
          onClick={() => {
            setDraft(String(value))
            setEditing(true)
          }}
          className="block w-full text-left font-mono text-sm font-semibold text-greentop-text hover:text-greentop-green"
        >
          {value.toLocaleString()}
          {suffix}
        </button>
      )}
    </div>
  )
}

/** A non-editable text stat (e.g. roof construction). */
function TextStat({ icon: Icon, label, value }: { icon: typeof Ruler; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-greentop-border bg-greentop-surface p-3">
      <div className="mb-1 flex items-center gap-1.5 text-greentop-muted">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-[11px] uppercase tracking-wide">{label}</span>
      </div>
      <p className="font-mono text-sm font-semibold text-greentop-text">{value}</p>
    </div>
  )
}

export function BuildingInfo() {
  const b = useMapStore((s) => s.selectedBuilding)
  const updateBuilding = useMapStore((s) => s.updateSelectedBuilding)
  const advanceTo = useMapStore((s) => s.advanceTo)
  const solar = useAnalysisStore((s) => s.solar)
  const patchSolar = useAnalysisStore((s) => s.patchSolar)
  if (!b) return null

  const prewar = b.yearBuilt < 1980

  // Prefer Google-measured values when the Solar API returned data.
  const roofAreaSqFt = solar?.roofAreaSqFt ?? b.roofAreaSqFt
  const sunHrs = solar?.sunExposureHrsPerDay ?? b.sunExposureHrsPerDay
  const costs = hiddenCosts(b, roofAreaSqFt)

  return (
    <div className="flex flex-col gap-5 p-5">
      <div>
        <div className="mb-2 flex items-center gap-2">
          <Badge className="bg-greentop-green/15 text-greentop-green capitalize">
            {b.buildingType}
          </Badge>
          <Badge variant="outline" className="border-greentop-border text-greentop-muted">
            Built {b.yearBuilt}
          </Badge>
        </div>
        <h3 className="text-lg font-semibold leading-tight text-greentop-text">{b.name}</h3>
      </div>

      <p className="-mb-1 text-xs text-greentop-muted">Tap any value to edit if it looks out of date.</p>

      <div className="grid grid-cols-2 gap-2.5">
        <EditableStat
          icon={Ruler}
          label="Roof Area"
          value={roofAreaSqFt}
          suffix=" ft²"
          onCommit={(n) => {
            updateBuilding({ roofAreaSqFt: n })
            if (solar) patchSolar({ roofAreaSqFt: n })
          }}
        />
        <TextStat icon={Layers} label="Roof" value={`${b.roofType} · ${b.roofMaterial}`} />
        <EditableStat
          icon={Weight}
          label="Max Load"
          value={b.maxLoadPSF}
          suffix=" lbs/ft²"
          onCommit={(n) => updateBuilding({ maxLoadPSF: n })}
        />
        <EditableStat
          icon={Sun}
          label="Sun Exposure"
          value={sunHrs}
          suffix=" hrs/day"
          onCommit={(n) => {
            updateBuilding({ sunExposureHrsPerDay: n })
            if (solar) patchSolar({ sunExposureHrsPerDay: n })
          }}
        />
        <EditableStat
          icon={Thermometer}
          label="Heat Island"
          value={b.heatIslandIntensityF}
          suffix=" °F"
          onCommit={(n) => updateBuilding({ heatIslandIntensityF: n })}
        />
        <EditableStat
          icon={Droplets}
          label="Stormwater"
          value={b.annualStormwaterCreditDollars}
          suffix=" $/yr"
          onCommit={(n) => updateBuilding({ annualStormwaterCreditDollars: n })}
        />
      </div>

      {prewar && (
        <div className="flex items-start gap-2 rounded-xl border border-greentop-amber/40 bg-greentop-amber/10 p-3 text-sm text-greentop-amber">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Pre-1980 construction — heavier rooftop systems may need a structural review.</span>
        </div>
      )}

      <div className="rounded-xl border border-greentop-red/30 bg-greentop-red/5 p-4">
        <p className="mb-3 text-xs font-mono uppercase tracking-widest text-greentop-red">
          What this roof costs you today
        </p>
        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between text-greentop-muted">
            <span>Excess cooling load</span>
            <span className="font-mono text-greentop-text">${costs.cooling.toLocaleString()}/yr</span>
          </div>
          <div className="flex justify-between text-greentop-muted">
            <span>Stormwater fees forgone</span>
            <span className="font-mono text-greentop-text">${costs.stormwater.toLocaleString()}/yr</span>
          </div>
          <div className="flex justify-between text-greentop-muted">
            <span>Roof maintenance overhead</span>
            <span className="font-mono text-greentop-text">${costs.maintenance.toLocaleString()}/yr</span>
          </div>
          <div className="mt-2 flex justify-between border-t border-greentop-border pt-2 font-semibold">
            <span className="text-greentop-text">Total hidden cost</span>
            <span className="font-mono text-greentop-red">${costs.total.toLocaleString()}/yr</span>
          </div>
        </div>
      </div>

      <Button
        onClick={() => advanceTo('preferences')}
        className="h-12 w-full gap-2 bg-greentop-green text-base font-semibold text-white hover:bg-greentop-green-dim"
      >
        Analyze My Roof
        <ArrowRight className="h-4 w-4" />
      </Button>
    </div>
  )
}
