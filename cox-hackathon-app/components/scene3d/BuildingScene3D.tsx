'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, Html, Grid, Environment, ContactShadows } from '@react-three/drei'
import * as THREE from 'three'
import { Sun, Droplets, Leaf, TreePine, Zap, Flower2, Loader2 } from 'lucide-react'
import { useMapStore } from '@/stores/mapStore'
import { useAnalysisStore } from '@/stores/analysisStore'
import { fetchBuildingTwin, type BuildingTwin } from '@/lib/twin'
import { BuildingTwinMesh } from './BuildingTwinMesh'
import type { RoofPlane, SolarData } from '@/lib/solar'

/** A roof plane carried through the scene in local meters (scaled at render). */
type ScenePlane = RoofPlane

// The real DSM tile is mapped so its largest ground dimension is this many
// scene units; building height scales by the same factor, keeping proportions.
const TWIN_TILE_UNITS = 11

/**
 * Fetch the real photogrammetric twin (DSM + aerial imagery) for a location.
 * Returns null while loading or when no coverage exists, so the scene can fall
 * back to the geometric reconstruction.
 */
function useBuildingTwin(lat: number, lng: number) {
  const [twin, setTwin] = useState<BuildingTwin | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setTwin(null)
    setLoading(true)
    fetchBuildingTwin(lat, lng).then((t) => {
      if (cancelled) return
      setTwin(t)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [lat, lng])

  return { twin, loading }
}

const COLORS = {
  facade: '#475467',
  facadeDark: '#1f2937',
  roofMembrane: '#2b2f33',
  parapet: '#11151a',
  grid: '#d8cdb4',
  // Solid greentop-themed green/grey used for measured roof planes — shaded by
  // the scene's lighting instead of colour-coded by sun exposure.
  roofAccent: '#3f5a4a',
}

const STORIES_BY_TYPE: Record<string, number> = {
  warehouse: 2,
  retail: 2,
  residential: 3,
  office: 7,
}

/** Building footprint (scene units) derived from the measured/modelled roof area. */
function footprintFor(roofAreaSqFt: number, buildingType: string) {
  const aspect = buildingType === 'warehouse' ? 1.9 : buildingType === 'retail' ? 1.5 : 1.25
  const areaUnits = roofAreaSqFt / 900
  const depth = Math.sqrt(Math.max(areaUnits, 4) / aspect)
  const width = aspect * depth
  const clamp = (n: number) => Math.min(Math.max(n, 2.5), 6.5)
  return { width: clamp(width), depth: clamp(depth) }
}

const FLOOR_HEIGHT = 0.42
const TARGET_MAX = 6.5 // largest real footprint dimension, in scene units

interface TwinGeometry {
  real: boolean        // true once we're rendering measured roof geometry
  width: number        // body footprint (scene units)
  depth: number
  bodyHeight: number   // scene units
  stories: number
  scale: number        // meters → scene units (for real planes)
  planes: ScenePlane[] // real roof planes, in meters
}

/**
 * Turn measured Solar roof geometry into a scene-unit twin, falling back to
 * the generic block (modelled roof area + type-based stories) when no real
 * geometry is available.
 */
function buildTwin(
  solar: SolarData | null,
  roofAreaSqFt: number,
  buildingType: string,
): TwinGeometry {
  const stories = STORIES_BY_TYPE[buildingType] ?? 4
  const bodyHeight = stories * FLOOR_HEIGHT
  const planes = solar?.roofPlanes ?? []

  // Real footprint (meters): prefer the API bounding box, else the union of
  // the roof planes' boxes.
  let footM = solar?.footprintM ?? null
  if (!footM && planes.length) {
    let minX = Infinity
    let maxX = -Infinity
    let minZ = Infinity
    let maxZ = -Infinity
    for (const p of planes) {
      minX = Math.min(minX, p.cx - p.width / 2)
      maxX = Math.max(maxX, p.cx + p.width / 2)
      minZ = Math.min(minZ, p.cz - p.depth / 2)
      maxZ = Math.max(maxZ, p.cz + p.depth / 2)
    }
    footM = { width: maxX - minX, depth: maxZ - minZ }
  }

  if (planes.length && footM && footM.width > 1 && footM.depth > 1) {
    const scale = TARGET_MAX / Math.max(footM.width, footM.depth)
    return {
      real: true,
      width: footM.width * scale,
      depth: footM.depth * scale,
      bodyHeight,
      stories,
      scale,
      planes,
    }
  }

  const { width, depth } = footprintFor(roofAreaSqFt, buildingType)
  return { real: false, width, depth, bodyHeight, stories, scale: 1, planes: [] }
}

/** Procedural window-grid texture so the facade reads as a building, not a flat box. */
function useFacadeTexture(stories: number) {
  return useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 256
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.fillStyle = COLORS.facade
    ctx.fillRect(0, 0, 256, 256)
    const cols = 6
    const rowH = 256 / stories
    const colW = 256 / cols
    let seed = stories * 97
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0
      return seed / 4294967296
    }
    for (let r = 0; r < stories; r++) {
      for (let c = 0; c < cols; c++) {
        const pad = colW * 0.18
        ctx.fillStyle = rand() > 0.22 ? '#bae6fd' : '#1e293b'
        ctx.globalAlpha = 0.85
        ctx.fillRect(c * colW + pad, r * rowH + pad * 0.6, colW - pad * 2, rowH - pad * 1.2)
      }
    }
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    return tex
  }, [stories])
}

/** The windowed facade box — the building massing, shared by both roof variants. */
function BuildingBody({
  width,
  depth,
  bodyHeight,
  stories,
}: {
  width: number
  depth: number
  bodyHeight: number
  stories: number
}) {
  const facadeTex = useFacadeTexture(stories)
  return (
    <mesh position={[0, bodyHeight / 2, 0]} castShadow receiveShadow>
      <boxGeometry args={[width, bodyHeight, depth]} />
      <meshStandardMaterial attach="material-0" map={facadeTex} roughness={0.7} />
      <meshStandardMaterial attach="material-1" map={facadeTex} roughness={0.7} />
      <meshStandardMaterial attach="material-2" color={COLORS.roofMembrane} roughness={0.95} />
      <meshStandardMaterial attach="material-3" color={COLORS.facadeDark} roughness={1} />
      <meshStandardMaterial attach="material-4" map={facadeTex} roughness={0.7} />
      <meshStandardMaterial attach="material-5" map={facadeTex} roughness={0.7} />
    </mesh>
  )
}

/** Generic flat membrane + parapet — used when no real roof geometry exists. */
function GenericRoof({ width, depth, bodyHeight }: { width: number; depth: number; bodyHeight: number }) {
  return (
    <group>
      <mesh position={[0, bodyHeight + 0.04, 0]} receiveShadow castShadow>
        <boxGeometry args={[width * 1.02, 0.08, depth * 1.02]} />
        <meshStandardMaterial color={COLORS.roofMembrane} roughness={0.95} />
      </mesh>
      <mesh position={[0, bodyHeight + 0.16, 0]}>
        <boxGeometry args={[width * 1.02, 0.16, depth * 1.02]} />
        <meshStandardMaterial color={COLORS.parapet} roughness={0.9} wireframe />
      </mesh>
    </group>
  )
}

/** One real roof plane, tilted to its measured pitch & azimuth. */
function TwinRoofPlane({ plane, scale, baseY }: { plane: ScenePlane; scale: number; baseY: number }) {
  const quaternion = useMemo(() => {
    const az = (plane.azimuthDeg * Math.PI) / 180
    const pitch = Math.min(plane.pitchDeg, 38) * (Math.PI / 180) // cap for sane visuals
    // Tilt about the horizontal axis perpendicular to the plane's facing
    // direction, keeping its plan footprint axis-aligned with the bbox.
    const axis = new THREE.Vector3(Math.cos(az), 0, Math.sin(az))
    return new THREE.Quaternion().setFromAxisAngle(axis, pitch)
  }, [plane])

  return (
    <mesh
      position={[plane.cx * scale, baseY + plane.relHeight * scale + 0.03, plane.cz * scale]}
      quaternion={quaternion}
      castShadow
      receiveShadow
    >
      <boxGeometry args={[plane.width * scale, 0.07, plane.depth * scale]} />
      <meshStandardMaterial color={COLORS.roofAccent} roughness={0.82} metalness={0.05} />
    </mesh>
  )
}

const OPTION_ICON: Record<string, { icon: typeof Leaf; color: string }> = {
  'cool-roof': { icon: Sun, color: '#7dd3fc' },
  solar: { icon: Zap, color: '#f59e0b' },
  'green-roof-extensive': { icon: Leaf, color: '#22c55e' },
  'green-roof-intensive': { icon: TreePine, color: '#16a34a' },
  rainwater: { icon: Droplets, color: '#0ea5e9' },
  beekeeping: { icon: Flower2, color: '#eab308' },
}

function RoofFeaturePin({
  option,
  isTop,
  position,
}: {
  option: { id: string; name: string }
  isTop: boolean
  position: [number, number, number]
}) {
  const meta = OPTION_ICON[option.id] ?? { icon: Leaf, color: '#22c55e' }
  const Icon = meta.icon
  const selectedOptionId = useAnalysisStore((s) => s.selectedOptionId)
  const setSelectedOptionId = useAnalysisStore((s) => s.setSelectedOptionId)
  const isSelected = selectedOptionId === option.id
  return (
    <Html position={position} center distanceFactor={9} zIndexRange={[10, 0]}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setSelectedOptionId(option.id)
        }}
        className="flex flex-col items-center gap-1 bg-transparent p-0 transition-transform"
        style={{ transform: isSelected ? 'scale(1.18)' : undefined }}
      >
        <span
          className={`flex h-7 w-7 items-center justify-center rounded-full border-2 shadow-lg ${
            isSelected
              ? 'border-white ring-2 ring-greentop-green ring-offset-1 ring-offset-black/40'
              : isTop
                ? 'border-greentop-green'
                : 'border-white/80'
          }`}
          style={{ backgroundColor: meta.color }}
        >
          <Icon className="h-3.5 w-3.5 text-black/80" />
        </span>
        <span
          className={`whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-medium text-white shadow ${
            isSelected ? 'bg-greentop-green/90 text-black' : 'bg-black/75'
          }`}
        >
          {isTop ? `★ ${option.name}` : option.name}
        </span>
      </button>
    </Html>
  )
}

function Scene({ dsmTwin, twinLoading }: { dsmTwin: BuildingTwin | null; twinLoading: boolean }) {
  const building = useMapStore((s) => s.selectedBuilding)
  const solar = useAnalysisStore((s) => s.solar)
  const dashboardAnalysis = useAnalysisStore((s) => s.dashboardAnalysis)
  if (!building) return null

  const roofAreaSqFt = solar?.roofAreaSqFt ?? building.roofAreaSqFt

  // Geometric reconstruction (real roof planes or generic block) — used as the
  // fallback whenever the photogrammetric DSM twin isn't available.
  const geo = useMemo(
    () => buildTwin(solar, roofAreaSqFt, building.buildingType),
    [solar, roofAreaSqFt, building.buildingType],
  )

  // Scale + roof height for the DSM twin, when present.
  const dsmScale = dsmTwin ? TWIN_TILE_UNITS / Math.max(dsmTwin.extentM.x, dsmTwin.extentM.z) : 1
  const dsmHeight = dsmTwin ? dsmTwin.maxHeightM * dsmScale : 0

  const topY = dsmTwin ? dsmHeight : geo.bodyHeight

  // Widgets = ONLY the recommended plan's components, and only once the analysis
  // has produced them. Before results there is no plan, so the roof stays clean.
  const planComponents = dashboardAnalysis?.plan?.components ?? []
  const featureOptions = useMemo(
    () => planComponents.map((c) => ({ id: c.optionId, name: c.name })),
    [planComponents],
  )

  // Frame the camera to the building's real size: a one-storey warehouse and a
  // 40-storey tower need very different distances. Pull back to fit the larger
  // of footprint vs. height.
  const { camera } = useThree()
  useEffect(() => {
    const frame = Math.max(topY, TWIN_TILE_UNITS)
    const d = frame * 1.35
    camera.position.set(d, Math.max(topY * 0.55, frame * 0.5), d)
    camera.near = 0.1
    camera.far = frame * 14
    camera.updateProjectionMatrix()
  }, [camera, topY])

  // Cluster the pins at the roof-top centre so they ALWAYS sit on the building
  // — never floating off to the side, for any building shape. A small radius
  // keeps them within the central footprint of towers and wide roofs alike.
  const anchors = useMemo<[number, number, number][]>(() => {
    const n = featureOptions.length
    if (n === 0) return []
    const footprint = dsmTwin ? TWIN_TILE_UNITS : Math.min(geo.width, geo.depth)
    const radius = n === 1 ? 0 : footprint * 0.16
    const y = topY + Math.max(0.4, topY * 0.04)
    return featureOptions.map((_, i) => {
      const a = (i / n) * Math.PI * 2
      return [Math.cos(a) * radius, y, Math.sin(a) * radius] as [number, number, number]
    })
  }, [featureOptions, dsmTwin, geo.width, geo.depth, topY])

  return (
    <>
      <ambientLight intensity={0.7} />
      <directionalLight position={[6, 9, 4]} intensity={1.4} castShadow />

      {twinLoading ? (
        // Still checking for the photogrammetric twin — render nothing
        // rather than flash a placeholder; the correct model appears the
        // moment we know which one applies.
        null
      ) : dsmTwin ? (
        <BuildingTwinMesh twin={dsmTwin} scale={dsmScale} />
      ) : (
        <>
          <BuildingBody width={geo.width} depth={geo.depth} bodyHeight={geo.bodyHeight} stories={geo.stories} />
          {geo.real ? (
            geo.planes.map((p, i) => (
              <TwinRoofPlane key={i} plane={p} scale={geo.scale} baseY={geo.bodyHeight} />
            ))
          ) : (
            <GenericRoof width={geo.width} depth={geo.depth} bodyHeight={geo.bodyHeight} />
          )}
        </>
      )}

      {featureOptions.map((opt, i) => (
        <RoofFeaturePin key={opt.id} option={opt} isTop={i === 0} position={anchors[i]} />
      ))}

      <Grid
        position={[0, -0.02, 0]}
        args={[24, 24]}
        cellColor={COLORS.grid}
        sectionColor={COLORS.grid}
        fadeDistance={20}
        infiniteGrid
      />
      <ContactShadows position={[0, 0, 0]} opacity={0.5} scale={16} blur={2} far={4} />
      <OrbitControls
        enablePan={false}
        minDistance={Math.max(4, topY * 0.3)}
        maxDistance={Math.max(22, topY * 3)}
        minPolarAngle={0.3}
        maxPolarAngle={1.4}
        target={[0, topY * 0.45, 0]}
        autoRotate
        autoRotateSpeed={0.5}
      />
    </>
  )
}

export default function BuildingScene3D() {
  const building = useMapStore((s) => s.selectedBuilding)
  const { twin, loading } = useBuildingTwin(building?.lat ?? 0, building?.lng ?? 0)
  if (!building) return null

  return (
    <div className="relative h-full w-full bg-greentop-bg">
      <Canvas shadows="percentage" camera={{ position: [9, 7.5, 9], fov: 38 }} dpr={[1, 2]}>
        <color attach="background" args={['#f6f1e3']} />
        <Suspense fallback={null}>
          <Scene dsmTwin={twin} twinLoading={loading} />
          <Environment preset="city" />
        </Suspense>
      </Canvas>

      {loading && (
        <div className="pointer-events-none absolute inset-x-0 top-1/2 z-10 flex -translate-y-1/2 justify-center">
          <div className="flex items-center gap-2 rounded-full border border-greentop-border bg-greentop-surface/95 px-4 py-2 text-sm text-greentop-text shadow-lg backdrop-blur">
            <Loader2 className="h-4 w-4 animate-spin text-greentop-green" />
            Reconstructing 3D from aerial imagery…
          </div>
        </div>
      )}
    </div>
  )
}
