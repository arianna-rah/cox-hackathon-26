// Real rooftop solar data from the Google Solar API.
// The browser calls the same-origin /api/solar route (which adds the
// server-side GOOGLE_SOLAR_KEY), then we reduce the raw response to the
// handful of measured fields Canopy's scoring needs.

const M2_TO_SQFT = 10.7639
const DEG_LAT_METERS = 111_320 // meters per degree of latitude (≈ constant)

/**
 * One real roof plane measured by Google's Solar API, expressed in a local
 * metric frame centred on the building (east = +x, north = -z) so it can be
 * dropped straight into a three.js scene. This is what turns the generic box
 * into a twin of *this* roof.
 */
export interface RoofPlane {
  cx: number          // meters east of the building centre
  cz: number          // meters of -north (south = +z) from the building centre
  width: number       // E–W extent of the plane's bounding box, meters
  depth: number       // N–S extent of the plane's bounding box, meters
  areaM2: number      // measured plane area
  pitchDeg: number    // roof slope (0 = flat)
  azimuthDeg: number  // compass direction the plane faces (0 = N, 90 = E)
  relHeight: number   // meters above the lowest plane on this roof
}

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
  roofPlanes: RoofPlane[]           // real per-segment roof geometry (twin)
  footprintM: { width: number; depth: number } | null // real building footprint
}

interface RawConfig {
  panelsCount?: number
  yearlyEnergyDcKwh?: number
}

interface RawLatLng {
  latitude?: number
  longitude?: number
}

interface RawRoofSegment {
  pitchDegrees?: number
  azimuthDegrees?: number
  planeHeightAtCenterMeters?: number
  stats?: { areaMeters2?: number }
  center?: RawLatLng
  boundingBox?: { sw?: RawLatLng; ne?: RawLatLng }
}

interface RawSolarResponse {
  error?: unknown
  center?: RawLatLng
  boundingBox?: { sw?: RawLatLng; ne?: RawLatLng }
  solarPotential?: {
    panelCapacityWatts?: number
    maxArrayPanelsCount?: number
    maxSunshineHoursPerYear?: number
    carbonOffsetFactorKgPerMwh?: number
    wholeRoofStats?: { areaMeters2?: number }
    solarPanelConfigs?: RawConfig[]
    roofSegmentStats?: RawRoofSegment[]
  }
}

/** meters per degree of longitude at a given latitude */
function lngMeters(lat: number): number {
  return DEG_LAT_METERS * Math.cos((lat * Math.PI) / 180)
}

/**
 * Turn the Solar API's roof segments into local-metric RoofPlanes centred on
 * the building. Returns [] when the response carries no usable segment
 * geometry, so callers transparently fall back to the generic block model.
 */
function extractRoofPlanes(raw: RawSolarResponse): RoofPlane[] {
  const segs = raw.solarPotential?.roofSegmentStats ?? []
  if (segs.length === 0) return []

  // Reference point: the API's building centre, else the mean of segment
  // centres. Everything is expressed relative to this.
  const centers = segs
    .map((s) => s.center)
    .filter((c): c is RawLatLng => c?.latitude != null && c?.longitude != null)
  const refLat =
    raw.center?.latitude ??
    (centers.length ? centers.reduce((a, c) => a + c.latitude!, 0) / centers.length : undefined)
  const refLng =
    raw.center?.longitude ??
    (centers.length ? centers.reduce((a, c) => a + c.longitude!, 0) / centers.length : undefined)
  if (refLat == null || refLng == null) return []

  const mPerLng = lngMeters(refLat)

  const planes = segs
    .map((s): RoofPlane | null => {
      const c = s.center
      const bb = s.boundingBox
      if (c?.latitude == null || c?.longitude == null || !bb?.sw || !bb?.ne) return null
      const cx = (c.longitude - refLng) * mPerLng
      const cz = -(c.latitude - refLat) * DEG_LAT_METERS // north = -z
      const width = Math.abs((bb.ne.longitude! - bb.sw.longitude!) * mPerLng)
      const depth = Math.abs((bb.ne.latitude! - bb.sw.latitude!) * DEG_LAT_METERS)
      return {
        cx,
        cz,
        width,
        depth,
        areaM2: s.stats?.areaMeters2 ?? width * depth,
        pitchDeg: s.pitchDegrees ?? 0,
        azimuthDeg: s.azimuthDegrees ?? 180,
        relHeight: s.planeHeightAtCenterMeters ?? 0,
      }
    })
    .filter((p): p is RoofPlane => p !== null)

  if (planes.length === 0) return []

  // Re-base heights so the lowest plane sits at 0.
  const minH = Math.min(...planes.map((p) => p.relHeight))
  for (const p of planes) p.relHeight -= minH
  return planes
}

/** Real building footprint (meters) from the response bounding box, if present. */
function extractFootprint(raw: RawSolarResponse): { width: number; depth: number } | null {
  const bb = raw.boundingBox
  if (!bb?.sw?.latitude || !bb?.ne?.latitude || bb.sw.longitude == null || bb.ne.longitude == null) {
    return null
  }
  const midLat = (bb.sw.latitude + bb.ne.latitude) / 2
  return {
    width: Math.abs((bb.ne.longitude - bb.sw.longitude) * lngMeters(midLat)),
    depth: Math.abs((bb.ne.latitude - bb.sw.latitude) * DEG_LAT_METERS),
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
    roofPlanes: extractRoofPlanes(raw),
    footprintM: extractFootprint(raw),
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
