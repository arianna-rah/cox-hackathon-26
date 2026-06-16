'use client'

import { useMemo } from 'react'
import * as THREE from 'three'
import type { BuildingTwin } from '@/lib/twin'

// Solid canopy-themed green/grey instead of the raw aerial photo colours —
// keeps the twin's true measured shape while matching the site's palette.
// Lighting (via face normals + meshStandardMaterial) still shades the
// faces, so the form reads clearly without a multicoloured photo gradient.
const TWIN_COLOR = '#3f5a4a'

// Pixels at/below this height are treated as "no building" — skipped
// entirely so the mesh doesn't paint the whole DSM tile (driveways,
// neighbouring grade, etc.), just the structure itself.
const MIN_HEIGHT_M = 0.15

/**
 * Raw DSM pixels occasionally spike (sensor noise, a single misread cell) —
 * extruded literally, a spike becomes a thin needle jutting off the
 * silhouette. A 3x3 median pass folds each pixel into its local neighbourhood
 * so the building's true facets survive but single-pixel outliers don't.
 */
function despeckle(heights: Float32Array, w: number, h: number): Float32Array {
  const out = new Float32Array(w * h)
  const window: number[] = []
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      window.length = 0
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const x = c + dc
          const y = r + dr
          window.push(x < 0 || y < 0 || x >= w || y >= h ? 0 : heights[y * w + x])
        }
      }
      window.sort((a, b) => a - b)
      out[r * w + c] = window[4] // median of 9
    }
  }
  return out
}

/**
 * Builds a closed, fully-solid extrusion of the real DSM height field: each
 * raster cell becomes a flat-topped column with vertical walls dropped to
 * every lower neighbour (or to the ground when a neighbour is missing, e.g.
 * at the edge of the coverage tile). Unlike sampling height onto a single
 * shared-vertex plane — where a sparse or noisy mask boundary interpolates
 * into a sloped ramp and the building can look like it "opens up" on one
 * side — every side here is an explicit wall, so the shape is airtight no
 * matter how the underlying mask cuts off.
 */
function buildVoxelGeometry(twin: BuildingTwin, scale: number): THREE.BufferGeometry {
  const { width: w, height: h } = twin
  // Two passes knock out wider noise clusters (a single pass only cleans
  // true single-pixel spikes) without eroding genuine roof-edge geometry.
  const heights = despeckle(despeckle(twin.heights, w, h), w, h)
  const cellW = (twin.extentM.x * scale) / w
  const cellD = (twin.extentM.z * scale) / h
  const halfW = (w * cellW) / 2
  const halfD = (h * cellD) / 2

  const heightAt = (c: number, r: number) => {
    if (c < 0 || r < 0 || c >= w || r >= h) return 0
    const v = heights[r * w + c]
    return v > MIN_HEIGHT_M ? v * scale : 0
  }

  const positions: number[] = []
  const normals: number[] = []

  const pushQuad = (
    p1: [number, number, number],
    p2: [number, number, number],
    p3: [number, number, number],
    p4: [number, number, number],
    normal: [number, number, number],
  ) => {
    // Faces only render from the side their winding faces (the default
    // material backface-culls). Rather than hand-verify every call site,
    // flip the quad here whenever its actual winding points away from the
    // outward normal we want — otherwise some walls/tops silently vanish
    // from certain camera angles, reading as a "see-through" building.
    const e1: [number, number, number] = [p2[0] - p1[0], p2[1] - p1[1], p2[2] - p1[2]]
    const e2: [number, number, number] = [p3[0] - p1[0], p3[1] - p1[1], p3[2] - p1[2]]
    const cross: [number, number, number] = [
      e1[1] * e2[2] - e1[2] * e2[1],
      e1[2] * e2[0] - e1[0] * e2[2],
      e1[0] * e2[1] - e1[1] * e2[0],
    ]
    const dot = cross[0] * normal[0] + cross[1] * normal[1] + cross[2] * normal[2]
    if (dot < 0) {
      ;[p2, p4] = [p4, p2] // reverse winding: swap the quad's opposite corners
    }
    positions.push(...p1, ...p2, ...p3, ...p1, ...p3, ...p4)
    for (let k = 0; k < 6; k++) normals.push(...normal)
  }

  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      const hgt = heightAt(c, r)
      if (hgt <= 0) continue

      const x0 = c * cellW - halfW
      const x1 = x0 + cellW
      const z0 = r * cellD - halfD
      const z1 = z0 + cellD

      // Flat top — every column reads as a clean roof facet, not a sloped
      // interpolation toward its neighbours.
      pushQuad([x0, hgt, z0], [x1, hgt, z0], [x1, hgt, z1], [x0, hgt, z1], [0, 1, 0])

      // A wall toward each neighbour that's lower (or absent), closing the
      // gap all the way down to that neighbour's height — 0 at the
      // coverage edge, so the silhouette is always sealed.
      const east = heightAt(c + 1, r)
      const west = heightAt(c - 1, r)
      const north = heightAt(c, r - 1)
      const south = heightAt(c, r + 1)
      if (east < hgt) pushQuad([x1, hgt, z0], [x1, east, z0], [x1, east, z1], [x1, hgt, z1], [1, 0, 0])
      if (west < hgt) pushQuad([x0, west, z0], [x0, hgt, z0], [x0, hgt, z1], [x0, west, z1], [-1, 0, 0])
      if (north < hgt) pushQuad([x0, north, z0], [x1, north, z0], [x1, hgt, z0], [x0, hgt, z0], [0, 0, -1])
      if (south < hgt) pushQuad([x0, hgt, z1], [x1, hgt, z1], [x1, south, z1], [x0, south, z1], [0, 0, 1])
    }
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  return geo
}

export function BuildingTwinMesh({ twin, scale }: { twin: BuildingTwin; scale: number }) {
  const geometry = useMemo(() => buildVoxelGeometry(twin, scale), [twin, scale])

  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial color={TWIN_COLOR} roughness={0.88} metalness={0.04} />
    </mesh>
  )
}
