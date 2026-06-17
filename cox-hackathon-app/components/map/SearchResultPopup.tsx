'use client'

import { useState } from 'react'
import { Loader2, MapPin, ArrowRight, XCircle } from 'lucide-react'
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

/**
 * Estimate the urban heat island (UHI) intensity above the rural Atlanta baseline.
 * Source: EPA "Reducing Urban Heat Islands" fact sheets; Atlanta UHI research
 * (Stone et al. 2012 — Atlanta UHI 2–8°F depending on land cover and density).
 * Atlanta mean UHI: ~4°F baseline for urban commercial zones.
 */
function estimateHeatIslandF(
  buildingType: Building['buildingType'],
  roofType: string,
  yearBuilt: number,
): number {
  // Atlanta urban commercial baseline (EPA / Georgia EPD data)
  let base = 4.0

  // Denser/more impervious building types increase local UHI
  if (buildingType === 'office') base += 1.8      // dense urban core, minimal green
  else if (buildingType === 'retail') base += 1.2  // parking lots, impervious surfaces
  else if (buildingType === 'warehouse') base += 0.6
  else if (buildingType === 'residential') base += 0.3

  // Dark roofs (common in commercial stock) re-radiate heat into the local microclimate
  if (/flat|membrane|tpo|epdm|built-up|gravel|dark/i.test(roofType)) base += 0.5

  // Older buildings were built before green-space codes; surroundings are more paved
  if (yearBuilt < 1970) base += 0.7
  else if (yearBuilt < 1990) base += 0.3
  else if (yearBuilt >= 2010) base -= 0.3  // modern infill often has more tree canopy

  // Clamp to a realistic Atlanta range (EPA: 1.5–10°F)
  return Math.round(Math.min(10, Math.max(1.5, base)) * 10) / 10
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
    heatIslandIntensityF: estimateHeatIslandF(buildingTypeFromOSM(category, osmType), solar?.roof_type ?? 'Flat', 2000),
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
          <Card className="gap-0 border-greentop-border bg-greentop-surface/95 p-4 shadow-2xl backdrop-blur-md">
            <div className="mb-3 flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-greentop-green" />
              <p className="truncate text-sm font-semibold text-greentop-text">{place.name}</p>
            </div>

            <div className="mb-3 rounded-lg bg-greentop-bg/60 px-3 py-2 font-mono text-xs text-greentop-muted">
              <span className="text-greentop-green">lat</span>{' '}
              {place.lat.toFixed(5)}
              {'  '}
              <span className="text-greentop-green">lng</span>{' '}
              {place.lng.toFixed(5)}
            </div>

            {/* Only flag the failure case; a detected building needs no badge. */}
            {!valid && (
              <div className="mb-4 flex items-center gap-2 rounded-lg bg-greentop-red/10 px-3 py-2 text-xs font-medium text-greentop-red">
                <XCircle className="h-3.5 w-3.5 shrink-0" />
                No rooftop detected here
              </div>
            )}

            <Button
              onClick={handleAnalyze}
              disabled={loading || !valid}
              className="w-full gap-2 bg-greentop-green text-white hover:bg-greentop-green-dim disabled:cursor-not-allowed disabled:opacity-40"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Fetching solar data…
                </>
              ) : (
                <>
                  Continue
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
