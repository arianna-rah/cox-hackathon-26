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

async function buildingFromPlace(
  name: string,
  address: string,
  lat: number,
  lng: number,
): Promise<Building> {
  let solar: {
    sun_exposure_hrs_per_day?: number
    roof_area_m2?: number
    max_annual_kwh?: number
  } | null = null

  try {
    const res = await fetch(`/api/solar?lat=${lat}&lng=${lng}`)
    if (res.ok) {
      const raw = await res.json()
      const sp = raw?.solarPotential ?? {}
      const maxSunshine = sp.maxSunshineHoursPerYear ?? 0
      const configs: { yearlyEnergyDcKwh?: number }[] = sp.solarPanelConfigs ?? []
      const maxKwh = configs.reduce((m: number, c) => Math.max(m, c.yearlyEnergyDcKwh ?? 0), 0)
      solar = {
        sun_exposure_hrs_per_day: maxSunshine ? Math.round((maxSunshine / 365) * 10) / 10 : undefined,
        roof_area_m2: sp.wholeRoofStats?.areaMeters2,
        max_annual_kwh: maxKwh || undefined,
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
    buildingType: 'office',
    roofAreaSqFt: solar?.roof_area_m2 ? Math.round(solar.roof_area_m2 * 10.764) : 10000,
    roofType: 'Flat',
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
      const building = await buildingFromPlace(place.name, place.address, place.lat, place.lng)
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
