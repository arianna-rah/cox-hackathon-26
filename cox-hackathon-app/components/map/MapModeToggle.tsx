'use client'

import { Hand, SquareDashedMousePointer } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useMapStore, type MapMode } from '@/stores/mapStore'

const MODES: { id: MapMode; label: string; icon: typeof Hand }[] = [
  { id: 'pan', label: 'Move', icon: Hand },
  { id: 'select', label: 'Select', icon: SquareDashedMousePointer },
]

/**
 * Bottom-left control to switch between panning the map and dragging a
 * box over a roof to select a building.
 */
export function MapModeToggle() {
  const mapMode = useMapStore((s) => s.mapMode)
  const setMapMode = useMapStore((s) => s.setMapMode)

  return (
    <div className="absolute bottom-6 left-6 z-20 flex flex-col items-start gap-2">
      <div className="flex flex-col gap-1 rounded-2xl border border-canopy-border bg-canopy-surface/90 p-1.5 shadow-lg backdrop-blur-md">
        {MODES.map(({ id, label, icon: Icon }) => {
          const active = mapMode === id
          return (
            <button
              key={id}
              onClick={() => setMapMode(id)}
              aria-pressed={active}
              className={cn(
                'flex w-full items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-canopy-green text-canopy-bg'
                  : 'text-canopy-muted hover:bg-canopy-bg/60 hover:text-canopy-text',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </button>
          )
        })}
      </div>

      {mapMode === 'select' && (
        <p className="max-w-[12rem] rounded-2xl border border-canopy-border bg-canopy-surface/90 px-3 py-1.5 text-xs text-canopy-muted shadow-lg backdrop-blur-md">
          Drag a box over a roof to select it
        </p>
      )}
    </div>
  )
}
