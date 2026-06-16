// Builds a real 3-D "digital twin" of a building from Google Solar dataLayers.
//
// The dataLayers API returns three pixel-aligned GeoTIFF rasters for a tile:
//   • DSM  — digital surface model: per-pixel surface elevation (meters)
//   • RGB  — aerial imagery: the building's actual appearance
//   • mask — 1 where a building exists, 0 elsewhere
//
// We decode them, flood-fill the mask outward from the tile centre to isolate
// *this* building's footprint, and emit a per-vertex height + colour field that
// the scene extrudes into a textured mesh. This makes the rendered shape and
// surface come from the building's real geometry and photography — not a
// generic block.

import { fromArrayBuffer } from 'geotiff'

export interface BuildingTwin {
  width: number              // raster columns
  height: number             // raster rows
  heights: Float32Array      // meters above ground, 0 outside the target building
  colors: Float32Array       // width*height*3, sRGB 0..1, from the aerial RGB
  maxHeightM: number         // tallest point of the target building (m)
  extentM: { x: number; z: number } // ground footprint of the whole tile (m)
}

type Raster = {
  width: number
  height: number
  bands: ArrayLike<number>[]
  pixelMeters: number
}

async function readRaster(layerUrl: string): Promise<Raster> {
  const res = await fetch(`/api/solar/geotiff?url=${encodeURIComponent(layerUrl)}`)
  if (!res.ok) throw new Error(`geotiff ${res.status}`)
  const ab = await res.arrayBuffer()
  const tif = await fromArrayBuffer(ab)
  const img = await tif.getImage()
  const rasters = await img.readRasters()
  const bands = Array.isArray(rasters) ? (rasters as ArrayLike<number>[]) : [rasters as ArrayLike<number>]
  const res2 = img.getResolution() // [xRes, yRes] in CRS units (meters for UTM)
  return {
    width: img.getWidth(),
    height: img.getHeight(),
    bands,
    pixelMeters: Math.abs(res2[0]) || 0.5,
  }
}

const NODATA = -9000 // Solar DSM uses a large negative sentinel for no-data

/**
 * Flood-fill the building mask from the centre pixel to keep only the building
 * the user selected, dropping neighbours that share the tile. Returns a Uint8
 * map (1 = target building) the same size as the raster.
 */
function isolateTargetBuilding(mask: ArrayLike<number>, w: number, h: number): Uint8Array {
  const isBuilding = (i: number) => mask[i] > 0
  const cx = Math.floor(w / 2)
  const cy = Math.floor(h / 2)

  // Seed: the building pixel nearest the tile centre (the selected rooftop).
  let seed = -1
  for (let r = 0; r < Math.max(w, h) && seed < 0; r++) {
    for (let dy = -r; dy <= r && seed < 0; dy++) {
      for (let dx = -r; dx <= r && seed < 0; dx++) {
        const x = cx + dx
        const y = cy + dy
        if (x < 0 || y < 0 || x >= w || y >= h) continue
        if (isBuilding(y * w + x)) seed = y * w + x
      }
    }
  }

  const target = new Uint8Array(w * h)
  if (seed < 0) return target // no building in tile → caller falls back

  // Iterative 4-connected flood fill.
  const stack = [seed]
  target[seed] = 1
  while (stack.length) {
    const i = stack.pop() as number
    const x = i % w
    const y = (i / w) | 0
    const neighbors = [
      x > 0 ? i - 1 : -1,
      x < w - 1 ? i + 1 : -1,
      y > 0 ? i - w : -1,
      y < h - 1 ? i + w : -1,
    ]
    for (const n of neighbors) {
      if (n >= 0 && !target[n] && isBuilding(n)) {
        target[n] = 1
        stack.push(n)
      }
    }
  }
  return target
}

/** Fetch + assemble the twin, or null if no usable coverage (caller falls back). */
export async function fetchBuildingTwin(lat: number, lng: number): Promise<BuildingTwin | null> {
  try {
    const dlRes = await fetch(`/api/solar/datalayers?lat=${lat}&lng=${lng}`)
    if (!dlRes.ok) return null
    const dl = (await dlRes.json()) as {
      error?: unknown
      dsmUrl?: string
      rgbUrl?: string
      maskUrl?: string
    }
    if (dl.error || !dl.dsmUrl || !dl.rgbUrl || !dl.maskUrl) return null

    const [dsm, rgb, mask] = await Promise.all([
      readRaster(dl.dsmUrl),
      readRaster(dl.rgbUrl),
      readRaster(dl.maskUrl),
    ])

    const w = dsm.width
    const h = dsm.height
    // All three layers come back on the same grid at one pixelSizeMeters; if a
    // tile ever breaks that assumption, bail to the geometric fallback.
    if (rgb.width !== w || rgb.height !== h || mask.width !== w || mask.height !== h) return null

    const dsmBand = dsm.bands[0]
    const maskBand = mask.bands[0]
    const rBand = rgb.bands[0]
    const gBand = rgb.bands[1] ?? rgb.bands[0]
    const bBand = rgb.bands[2] ?? rgb.bands[0]

    const target = isolateTargetBuilding(maskBand, w, h)
    let targetCount = 0
    for (let i = 0; i < target.length; i++) targetCount += target[i]
    if (targetCount < 8) return null // too small to be a real footprint

    // Ground level = 10th-percentile DSM over non-target pixels (street level),
    // so building heights are measured above the surrounding grade.
    const groundSamples: number[] = []
    for (let i = 0; i < w * h; i++) {
      const v = dsmBand[i]
      if (!target[i] && v > NODATA && Number.isFinite(v)) groundSamples.push(v)
    }
    groundSamples.sort((a, b) => a - b)
    const ground =
      groundSamples.length > 0
        ? groundSamples[Math.floor(groundSamples.length * 0.1)]
        : 0

    const heights = new Float32Array(w * h)
    const colors = new Float32Array(w * h * 3)
    let maxHeightM = 0

    for (let i = 0; i < w * h; i++) {
      // Height: only the target building rises; everything else stays at grade.
      if (target[i]) {
        const v = dsmBand[i]
        const hgt = v > NODATA && Number.isFinite(v) ? Math.max(0, v - ground) : 0
        heights[i] = hgt
        if (hgt > maxHeightM) maxHeightM = hgt
      }
      // Colour: real aerial imagery for every pixel (building + ground context).
      colors[i * 3] = (rBand[i] ?? 0) / 255
      colors[i * 3 + 1] = (gBand[i] ?? 0) / 255
      colors[i * 3 + 2] = (bBand[i] ?? 0) / 255
    }

    return {
      width: w,
      height: h,
      heights,
      colors,
      maxHeightM,
      extentM: { x: w * dsm.pixelMeters, z: h * dsm.pixelMeters },
    }
  } catch {
    return null
  }
}
