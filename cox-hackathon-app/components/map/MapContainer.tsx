'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Map, {
  Marker,
  type MapRef,
  type MapLayerMouseEvent,
} from 'react-map-gl/maplibre'
import { MapPin, Loader2, Plus, Minus, Hand, SquareDashedMousePointer } from 'lucide-react'
import { cn } from '@/lib/utils'
import 'maplibre-gl/dist/maplibre-gl.css'
import { MAP_DEFAULTS, ESRI_SATELLITE_TILES } from '@/lib/constants'
import { useMapStore } from '@/stores/mapStore'
import { BuildingLayer } from './BuildingLayer'
import { CommunityLayer } from './CommunityLayer'

const MAP_STYLE = {
  version: 8 as const,
  sources: {
    'esri-satellite': {
      type: 'raster' as const,
      tiles: [ESRI_SATELLITE_TILES],
      tileSize: 256,
      attribution: 'Esri, Maxar, Earthstar Geographics',
    },
  },
  layers: [
    {
      id: 'esri-satellite-layer',
      type: 'raster' as const,
      source: 'esri-satellite',
    },
  ],
}

/** Drops a pin on the searched place. */
function SearchMarker() {
  const place = useMapStore((s) => s.searchPlace)

  if (!place) return null

  return (
    <Marker longitude={place.lng} latitude={place.lat} anchor="bottom">
      <MapPin className="h-8 w-8 fill-greentop-green text-white drop-shadow-lg" />
    </Marker>
  )
}

/** Pixel rectangle drawn while the user is dragging in select mode. */
interface DragBox {
  sx: number
  sy: number
  cx: number
  cy: number
}

// A drag shorter than this (px) is treated as a stray click, not a selection.
const MIN_DRAG_PX = 8

// Lat/lng padding (~5.5m) added to a building's footprint box, so a selection
// landing right at the roof edge still counts as on the rooftop.
const ROOF_BBOX_MARGIN = 0.00005

/**
 * Detect a rooftop at a point using the Google Solar building-insights API.
 * `findClosest` returns the *nearest* building even when the point sits on a
 * road or field, so we additionally require the point to fall within that
 * building's footprint box. Returns the building's exact centre, or null when
 * the point isn't on a rooftop (or coverage/key is unavailable).
 */
async function detectRooftop(
  lat: number,
  lng: number,
): Promise<{ lat: number; lng: number } | null> {
  try {
    const res = await fetch(`/api/solar?lat=${lat}&lng=${lng}`)
    if (!res.ok) return null
    const raw = (await res.json()) as {
      error?: unknown
      center?: { latitude: number; longitude: number }
      boundingBox?: {
        sw?: { latitude: number; longitude: number }
        ne?: { latitude: number; longitude: number }
      }
    }
    const bb = raw.boundingBox
    const c = raw.center
    if (raw.error || !c || !bb?.sw || !bb?.ne) return null

    const m = ROOF_BBOX_MARGIN
    const onRoof =
      lat >= bb.sw.latitude - m &&
      lat <= bb.ne.latitude + m &&
      lng >= bb.sw.longitude - m &&
      lng <= bb.ne.longitude + m
    if (!onRoof) return null

    return { lat: c.latitude, lng: c.longitude }
  } catch {
    return null
  }
}

/** Best-effort human label for a point (street/building name). */
async function reverseLabel(
  lat: number,
  lng: number,
): Promise<{ name: string; address: string } | null> {
  try {
    const res = await fetch(`/api/geocode?lat=${lat}&lng=${lng}`)
    const data = (await res.json()) as {
      results?: { name: string; address: string }[]
    }
    const hit = data.results?.[0]
    return hit ? { name: hit.name, address: hit.address } : null
  } catch {
    return null
  }
}

export default function MapContainer() {
  const mapRef = useRef<MapRef | null>(null)
  const selectedBuilding = useMapStore((s) => s.selectedBuilding)
  const searchPlace = useMapStore((s) => s.searchPlace)
  const mapMode = useMapStore((s) => s.mapMode)
  const setMapMode = useMapStore((s) => s.setMapMode)

  // Keep the current mode in a ref so the once-bound window listener and the
  // map event handlers always read the latest value.
  const modeRef = useRef(mapMode)
  modeRef.current = mapMode

  const [box, setBox] = useState<DragBox | null>(null)
  const boxRef = useRef<DragBox | null>(null)

  // True while a drag selection is being verified against the rooftop API.
  const [detecting, setDetecting] = useState(false)
  // Bumped on each selection so a slow request can't overwrite a newer one.
  const detectSeq = useRef(0)

  // Fly to the selected building whenever it changes.
  useEffect(() => {
    if (selectedBuilding) {
      mapRef.current?.flyTo({
        center: [selectedBuilding.lng, selectedBuilding.lat],
        zoom: 17,
        duration: 1200,
      })
    }
  }, [selectedBuilding])

  // Fly to a searched place whenever it changes.
  useEffect(() => {
    if (searchPlace) {
      mapRef.current?.flyTo({
        center: [searchPlace.lng, searchPlace.lat],
        zoom: 17,
        duration: 1200,
      })
    }
  }, [searchPlace])

  // Resolve the dragged point: verify there's actually a rooftop there, then
  // feed it into the same flow as the search bar (pin + Analyze popup). If no
  // rooftop is detected, the popup shows the same "not a building" state as a
  // non-building search, prompting the user to select again.
  const selectAt = useCallback(async (lat: number, lng: number) => {
    const seq = ++detectSeq.current
    setDetecting(true)
    const { setSearchPlace } = useMapStore.getState()

    const [roof, label] = await Promise.all([
      detectRooftop(lat, lng),
      reverseLabel(lat, lng),
    ])

    // A newer selection started while we were waiting — drop this result.
    if (seq !== detectSeq.current) return
    setDetecting(false)

    if (!roof) {
      // Not on a building/rooftop — invalid; popup will ask to re-select.
      setSearchPlace({
        name: 'No rooftop detected',
        address: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
        lat,
        lng,
        category: 'none',
        osmType: '',
      })
      return
    }

    // Snap to the Google-detected building centre for an exact location.
    setSearchPlace({
      name: label?.name ?? 'Selected rooftop',
      address:
        label?.address ?? `${roof.lat.toFixed(5)}, ${roof.lng.toFixed(5)}`,
      lat: roof.lat,
      lng: roof.lng,
      category: 'building',
      osmType: 'yes',
    })
  }, [])

  // Finalize a drag: turn the rectangle's centre into a building selection.
  // Stable identity so the window 'mouseup' listener (bound once) stays valid.
  const endDrag = useCallback(() => {
    const b = boxRef.current
    if (!b) return
    boxRef.current = null
    setBox(null)

    const dist = Math.hypot(b.cx - b.sx, b.cy - b.sy)
    if (dist < MIN_DRAG_PX) return

    const map = mapRef.current?.getMap()
    if (!map) return
    const center = map.unproject([(b.sx + b.cx) / 2, (b.sy + b.cy) / 2])
    void selectAt(center.lat, center.lng)
  }, [selectAt])

  // A release can land outside the canvas; catch it at the window level too.
  useEffect(() => {
    window.addEventListener('mouseup', endDrag)
    return () => window.removeEventListener('mouseup', endDrag)
  }, [endDrag])

  const handleMouseDown = useCallback((e: MapLayerMouseEvent) => {
    if (modeRef.current !== 'select') return
    const b = { sx: e.point.x, sy: e.point.y, cx: e.point.x, cy: e.point.y }
    boxRef.current = b
    setBox(b)
  }, [])

  const handleMouseMove = useCallback((e: MapLayerMouseEvent) => {
    if (!boxRef.current) return
    const b = { ...boxRef.current, cx: e.point.x, cy: e.point.y }
    boxRef.current = b
    setBox(b)
  }, [])

  const selecting = mapMode === 'select'

  return (
    <div className="relative h-full w-full">
      <Map
        ref={mapRef}
        id="main-map"
        mapStyle={MAP_STYLE}
        initialViewState={{
          latitude: MAP_DEFAULTS.lat,
          longitude: MAP_DEFAULTS.lng,
          zoom: MAP_DEFAULTS.zoom,
        }}
        maxZoom={18}
        dragPan={!selecting}
        cursor={selecting ? 'crosshair' : undefined}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={endDrag}
        style={{ width: '100%', height: '100%' }}
      >
        <SearchMarker />
        <BuildingLayer />
        <CommunityLayer />
      </Map>

      {/* Vertical control: zoom-in over the mode toggle, zoom-out under it. */}
      <div className="absolute left-4 top-4 z-10 flex flex-col gap-1 rounded-2xl border border-greentop-border bg-greentop-surface/90 p-1.5 shadow-lg backdrop-blur-md">
        <button
          onClick={() => mapRef.current?.getMap().zoomIn()}
          aria-label="Zoom in"
          className="flex h-9 w-9 items-center justify-center rounded-xl text-greentop-muted transition-colors hover:bg-greentop-bg/60 hover:text-greentop-text"
        >
          <Plus className="h-4 w-4" />
        </button>
        <button
          onClick={() => setMapMode('pan')}
          aria-pressed={mapMode === 'pan'}
          aria-label="Move"
          className={cn(
            'flex h-9 w-9 items-center justify-center rounded-xl transition-colors',
            mapMode === 'pan'
              ? 'bg-greentop-green text-white'
              : 'text-greentop-muted hover:bg-greentop-bg/60 hover:text-greentop-text',
          )}
        >
          <Hand className="h-4 w-4" />
        </button>
        <button
          onClick={() => setMapMode('select')}
          aria-pressed={mapMode === 'select'}
          aria-label="Select"
          className={cn(
            'flex h-9 w-9 items-center justify-center rounded-xl transition-colors',
            mapMode === 'select'
              ? 'bg-greentop-green text-white'
              : 'text-greentop-muted hover:bg-greentop-bg/60 hover:text-greentop-text',
          )}
        >
          <SquareDashedMousePointer className="h-4 w-4" />
        </button>
        <button
          onClick={() => mapRef.current?.getMap().zoomOut()}
          aria-label="Zoom out"
          className="flex h-9 w-9 items-center justify-center rounded-xl text-greentop-muted transition-colors hover:bg-greentop-bg/60 hover:text-greentop-text"
        >
          <Minus className="h-4 w-4" />
        </button>
      </div>

      {box && (
        <div
          className="pointer-events-none absolute z-10 rounded-sm border-2 border-greentop-green bg-greentop-green/20"
          style={{
            left: Math.min(box.sx, box.cx),
            top: Math.min(box.sy, box.cy),
            width: Math.abs(box.cx - box.sx),
            height: Math.abs(box.cy - box.sy),
          }}
        />
      )}

      {detecting && (
        <div className="pointer-events-none absolute bottom-6 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full border border-greentop-border bg-greentop-surface/95 px-4 py-2 text-sm text-greentop-text shadow-lg backdrop-blur-md">
          <Loader2 className="h-4 w-4 animate-spin text-greentop-green" />
          Detecting rooftop…
        </div>
      )}
    </div>
  )
}
