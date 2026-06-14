'use client'

import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useMapStore } from '@/stores/mapStore'
import { DEMO_BUILDINGS } from '@/lib/buildings'

const DEMOS: { key: keyof typeof DEMO_BUILDINGS; emoji: string; label: string }[] = [
  { key: 'castleberry', emoji: '🏭', label: 'Castleberry Hill Warehouse' },
  { key: 'midtown', emoji: '🏢', label: 'Midtown Apartment Tower' },
  { key: 'downtown', emoji: '🏛', label: 'Downtown Office Building' },
]

export function DemoPanel() {
  const selectBuilding = useMapStore((s) => s.selectBuilding)
  const selectedId = useMapStore((s) => s.selectedBuilding?.id)

  return (
    <Card className="w-72 gap-0 border-canopy-border bg-canopy-surface/90 p-4 backdrop-blur-md">
      <p className="mb-1 text-xs font-mono uppercase tracking-widest text-canopy-green">
        Demo Buildings
      </p>
      <p className="mb-3 text-sm text-canopy-muted">
        Pick a rooftop to analyze
      </p>
      <div className="flex flex-col gap-2">
        {DEMOS.map((d) => (
          <Button
            key={d.key}
            variant="outline"
            onClick={() => selectBuilding(DEMO_BUILDINGS[d.key])}
            className={`h-auto justify-start gap-3 border-canopy-border bg-canopy-bg/60 px-3 py-2.5 text-left text-canopy-text hover:border-canopy-green hover:bg-canopy-green/10 ${
              selectedId === d.key ? 'border-canopy-green ring-1 ring-canopy-green' : ''
            }`}
          >
            <span className="text-xl leading-none">{d.emoji}</span>
            <span className="text-sm font-medium">{d.label}</span>
          </Button>
        ))}
      </div>
    </Card>
  )
}
