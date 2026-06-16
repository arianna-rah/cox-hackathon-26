// Real rooftop solar data from the Google Solar API.
// The browser calls the same-origin /api/solar route (which adds the
// server-side GOOGLE_SOLAR_KEY), then we reduce the raw response to the
// handful of measured fields Canopy's scoring needs.

const M2_TO_SQFT = 10.7639

/** Measured, real-world solar facts for one rooftop. */
export interface SolarData {
  roofAreaSqFt: number              // Google-measured usable roof area
  maxPanels: number                 // panels in the best-producing config
  panelCapacityWatts: number        // watts per panel
  totalCapacityWatts: number        // maxPanels × panelCapacityWatts
  maxSunshineHoursPerYear: number   // measured annual sunshine
  sunExposureHrsPerDay: number      // derived from sunshine hours
  annualKwh: number                 // best config yearly DC production
  carbonOffsetFactorKgPerMwh: number // grid carbon intensity for this location
}

interface RawConfig {
  panelsCount?: number
  yearlyEnergyDcKwh?: number
}

interface RawSolarResponse {
  error?: unknown
  solarPotential?: {
    panelCapacityWatts?: number
    maxArrayPanelsCount?: number
    maxSunshineHoursPerYear?: number
    carbonOffsetFactorKgPerMwh?: number
    wholeRoofStats?: { areaMeters2?: number }
    solarPanelConfigs?: RawConfig[]
  }
}

/** Reduce a raw buildingInsights response to SolarData, or null if unusable. */
export function summarizeSolar(raw: RawSolarResponse): SolarData | null {
  const sp = raw.solarPotential
  if (!sp) return null

  const configs = sp.solarPanelConfigs ?? []
  if (configs.length === 0) return null

  // Best config = the one that produces the most energy.
  const best = configs.reduce(
    (a, c) => ((c.yearlyEnergyDcKwh ?? 0) > (a.yearlyEnergyDcKwh ?? 0) ? c : a),
    configs[0],
  )

  const panelCapacityWatts = sp.panelCapacityWatts ?? 400
  const maxPanels = best.panelsCount ?? sp.maxArrayPanelsCount ?? 0
  const annualKwh = best.yearlyEnergyDcKwh ?? 0
  const areaM2 = sp.wholeRoofStats?.areaMeters2 ?? 0
  const maxSun = sp.maxSunshineHoursPerYear ?? 0

  if (annualKwh <= 0 || maxPanels <= 0) return null

  return {
    roofAreaSqFt: Math.round(areaM2 * M2_TO_SQFT),
    maxPanels,
    panelCapacityWatts,
    totalCapacityWatts: maxPanels * panelCapacityWatts,
    maxSunshineHoursPerYear: Math.round(maxSun),
    sunExposureHrsPerDay: maxSun ? Math.round((maxSun / 365) * 10) / 10 : 0,
    annualKwh: Math.round(annualKwh),
    carbonOffsetFactorKgPerMwh: sp.carbonOffsetFactorKgPerMwh ?? 400,
  }
}

/**
 * Fetch + summarise real solar data for a lat/lng. Returns null on any
 * failure (no key, location not covered, network) so callers fall back to
 * the modelled estimates without breaking.
 */
export async function fetchSolarData(
  lat: number,
  lng: number,
): Promise<SolarData | null> {
  try {
    const res = await fetch(`/api/solar?lat=${lat}&lng=${lng}`)
    if (!res.ok) return null
    const raw = (await res.json()) as RawSolarResponse
    if (raw?.error) return null
    return summarizeSolar(raw)
  } catch {
    return null
  }
}
