'use client'

import { useState } from 'react'
import { Loader2, MapPin, Zap, CheckCircle2, XCircle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useMapStore, type SearchPlace } from '@/stores/mapStore'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import type { Building } from '@/types'

// Nominatim categories that correspond to actual structures/buildings.
const BUILDING_CATEGORIES = new Set([
  'building',
  'amenity',
  'shop',
  'office',
  'craft',
  'healthcare',
  'historic',
  'industrial',
  'man_made',
])

// Certain tourism OSM types are outdoor features, not buildings.
const OUTDOOR_TOURISM_TYPES = new Set([
  'viewpoint', 'picnic_site', 'camp_site', 'caravan_site', 'wilderness_hut',
])

function isValidBuilding(place: SearchPlace): boolean {
  const { category, osmType } = place
  if (BUILDING_CATEGORIES.has(category)) {
    if (category === 'tourism' && OUTDOOR_TOURISM_TYPES.has(osmType)) return false
    return true
  }
  // tourism is not in the set above — handle it here
  if (category === 'tourism') return !OUTDOOR_TOURISM_TYPES.has(osmType)
  return false
}

/**
 * Map Nominatim OSM category/type to a Building buildingType.
 * This is a best-effort heuristic — Nominatim tags are inconsistent, so the
 * default is 'office' (multi-story commercial) which is the safest fallback
 * when we can't determine the actual use.
 */
function buildingTypeFromOSM(category: string, osmType: string): Building['buildingType'] {
  const type = osmType.toLowerCase()
  if (category === 'industrial' || type === 'warehouse' || type === 'storage' || type === 'factory') {
    return 'warehouse'
  }
  if (
    category === 'shop' ||
    ['supermarket', 'convenience', 'mall', 'department_store', 'retail'].some((t) => type.includes(t))
  ) {
    return 'retail'
  }
  if (
    ['restaurant', 'cafe', 'bar', 'pub', 'fast_food', 'food_court', 'food', 'bakery', 'ice_cream'].includes(type)
  ) {
    return 'retail'
  }
  if (
    category === 'building' &&
    ['apartments', 'residential', 'house', 'detached', 'terrace', 'semidetached'].some((t) =>
      type.includes(t),
    )
  ) {
    return 'residential'
  }
  // Default: 'office' covers offices, healthcare, civic, amenities, etc.
  // This is intentionally conservative — it suppresses beekeeping for unknowns.
  return 'office'
}

async function buildingFromPlace(
  name: string,
  address: string,
  lat: number,
  lng: number,
  category = '',
  osmType = '',
): Promise<Building> {
  let solar: {
    sun_exposure_hrs_per_day?: number
    roof_area_m2?: number
    max_annual_kwh?: number
    roof_type?: string
  } | null = null

  try {
    const res = await fetch(`/api/solar?lat=${lat}&lng=${lng}`)
    if (res.ok) {
      const raw = await res.json()
      const sp = raw?.solarPotential ?? {}
      const maxSunshine = sp.maxSunshineHoursPerYear ?? 0
      const configs: { yearlyEnergyDcKwh?: number }[] = sp.solarPanelConfigs ?? []
      const maxKwh = configs.reduce((m: number, c) => Math.max(m, c.yearlyEnergyDcKwh ?? 0), 0)

      // Detect roof pitch from segment data to distinguish flat (commercial) from
      // pitched (residential/gabled) buildings. Weighted by each segment's area.
      let roof_type = 'Flat'
      const segs: { pitchDegrees?: number; stats?: { areaMeters2?: number } }[] =
        sp.roofSegmentStats ?? []
      if (segs.length > 0) {
        const totalArea = segs.reduce((s, seg) => s + (seg.stats?.areaMeters2 ?? 0), 0)
        const weightedPitch =
          totalArea > 0
            ? segs.reduce(
                (s, seg) =>
                  s + (seg.pitchDegrees ?? 0) * ((seg.stats?.areaMeters2 ?? 0) / totalArea),
                0,
              )
            : segs[0]?.pitchDegrees ?? 0
        roof_type = weightedPitch >= 15 ? 'Pitched' : 'Flat'
      }

      solar = {
        sun_exposure_hrs_per_day: maxSunshine ? Math.round((maxSunshine / 365) * 10) / 10 : undefined,
        roof_area_m2: sp.wholeRoofStats?.areaMeters2,
        max_annual_kwh: maxKwh || undefined,
        roof_type,
      }
    }
  } catch {
    // Solar API unavailable — use defaults
  }

  return {
    id: `search-${lat.toFixed(5)}-${lng.toFixed(5)}`,
    name,
    address,
    lat,
    lng,
    yearBuilt: 2000,
    buildingType: buildingTypeFromOSM(category, osmType),
    roofAreaSqFt: solar?.roof_area_m2 ? Math.round(solar.roof_area_m2 * 10.764) : 10000,
    roofType: solar?.roof_type ?? 'Flat',
    roofMaterial: 'Unknown',
    maxLoadPSF: 30,
    sunExposureHrsPerDay: solar?.sun_exposure_hrs_per_day ?? 5.0,
    heatIslandIntensityF: 5.5,
    annualStormwaterCreditDollars: 1200,
    neighborIds: [],
    precomputedSolarKwhPerYear: solar?.max_annual_kwh ?? 150000,
  }
}

export function SearchResultPopup() {
  const place = useMapStore((s) => s.searchPlace)
  const sidebarStep = useMapStore((s) => s.sidebarStep)
  const selectBuilding = useMapStore((s) => s.selectBuilding)

  const [loading, setLoading] = useState(false)

  const visible = place !== null && sidebarStep === 'closed'
  const valid = place ? isValidBuilding(place) : false

  async function handleAnalyze() {
    if (!place || !valid) return
    setLoading(true)
    try {
      const building = await buildingFromPlace(place.name, place.address, place.lat, place.lng, place.category, place.osmType)
      selectBuilding(building)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AnimatePresence>
      {visible && place && (
        <motion.div
          key="search-popup"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="absolute bottom-6 right-6 z-20 w-72"
        >
          <Card className="gap-0 border-canopy-border bg-canopy-surface/95 p-4 shadow-2xl backdrop-blur-md">
            <div className="mb-3 flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-canopy-green" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-canopy-text">{place.name}</p>
                <p className="mt-0.5 truncate text-xs text-canopy-muted">{place.address}</p>
              </div>
            </div>

            <div className="mb-3 rounded-lg bg-canopy-bg/60 px-3 py-2 font-mono text-xs text-canopy-muted">
              <span className="text-canopy-green">lat</span>{' '}
              {place.lat.toFixed(5)}
              {'  '}
              <span className="text-canopy-green">lng</span>{' '}
              {place.lng.toFixed(5)}
            </div>

            {/* Building validity badge */}
            <div className={`mb-4 flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium ${
              valid
                ? 'bg-canopy-green/10 text-canopy-green'
                : 'bg-canopy-red/10 text-canopy-red'
            }`}>
              {valid ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                  Building detected — ready to analyze
                </>
              ) : (
                <>
                  <XCircle className="h-3.5 w-3.5 shrink-0" />
                  No rooftop detected here — select a building to analyze
                </>
              )}
            </div>

            <Button
              onClick={handleAnalyze}
              disabled={loading || !valid}
              className="w-full gap-2 bg-canopy-green text-canopy-bg hover:bg-canopy-green-dim disabled:cursor-not-allowed disabled:opacity-40"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Fetching solar data…
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4" />
                  Analyze
                </>
              )}
            </Button>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
