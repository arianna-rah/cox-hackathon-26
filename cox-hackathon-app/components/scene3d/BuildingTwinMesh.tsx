'use client'

import { useMemo } from 'react'
import * as THREE from 'three'
import type { BuildingTwin } from '@/lib/twin'

/** sRGB (0..1) → linear, so the aerial colours render at the right brightness. */
function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

/**
 * Extrudes the real DSM height field into a mesh and paints every vertex with
 * the building's actual aerial imagery. The selected building rises to its
 * measured height; surrounding pixels stay at grade as flat photographic
 * context. This is the building's true shape + surface — not a generic block.
 */
export function BuildingTwinMesh({ twin, scale }: { twin: BuildingTwin; scale: number }) {
  const geometry = useMemo(() => {
    const { width: w, height: h, heights, colors } = twin
    const g = new THREE.PlaneGeometry(twin.extentM.x * scale, twin.extentM.z * scale, w - 1, h - 1)
    g.rotateX(-Math.PI / 2) // lay the grid flat; height becomes +Y

    const pos = g.attributes.position as THREE.BufferAttribute
    const vcol = new Float32Array(w * h * 3)
    for (let i = 0; i < w * h; i++) {
      pos.setY(i, heights[i] * scale)
      vcol[i * 3] = srgbToLinear(colors[i * 3])
      vcol[i * 3 + 1] = srgbToLinear(colors[i * 3 + 1])
      vcol[i * 3 + 2] = srgbToLinear(colors[i * 3 + 2])
    }
    pos.needsUpdate = true
    g.setAttribute('color', new THREE.BufferAttribute(vcol, 3))
    g.computeVertexNormals()
    return g
  }, [twin, scale])

  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial vertexColors roughness={0.92} metalness={0.02} />
    </mesh>
  )
}
