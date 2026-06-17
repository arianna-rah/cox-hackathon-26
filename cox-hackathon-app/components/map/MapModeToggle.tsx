'use client'

import { Hand, SquareDashedMousePointer } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useMapStore, type MapMode } from '@/stores/mapStore'

const MODES: { id: MapMode; label: string; icon: typeof Hand }[] = [
  { id: 'pan', label: 'Move', icon: Hand },
  { id: 'select', label: 'Select', icon: SquareDashedMousePointer },
]

/**
 * Top-left control to switch between panning the map and dragging a box
 * over a roof to select a building.
 */
export function MapModeToggle() {
  const mapMode = useMapStore((s) => s.mapMode)
  const setMapMode = useMapStore((s) => s.setMapMode)

  return (
    <div className="absolute top-4 left-4 z-20 flex gap-1 rounded-2xl border border-greentop-border bg-greentop-surface/90 p-1.5 shadow-lg backdrop-blur-md">
      {MODES.map(({ id, label, icon: Icon }) => {
        const active = mapMode === id
        return (
          <button
            key={id}
            onClick={() => setMapMode(id)}
            aria-pressed={active}
            className={cn(
              'flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition-colors',
              active
                ? 'bg-greentop-green text-white'
                : 'text-greentop-muted hover:bg-greentop-bg/60 hover:text-greentop-text',
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </button>
        )
      })}
    </div>
  )
}
