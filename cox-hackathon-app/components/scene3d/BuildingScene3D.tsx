'use client'

import { Suspense, useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Html, Grid, Environment, ContactShadows } from '@react-three/drei'
import * as THREE from 'three'
import { Ruler, Sun, Thermometer, Droplets, Leaf, TreePine, Zap, Flower2, Loader2, Trophy } from 'lucide-react'
import { useMapStore } from '@/stores/mapStore'
import { useAnalysisStore } from '@/stores/analysisStore'
import type { ScoredOption } from '@/types'

const COLORS = {
  facade: '#475467',
  facadeDark: '#1f2937',
  roofMembrane: '#2b2f33',
  parapet: '#11151a',
  grid: '#1e3a22',
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

/** Deterministic-but-scattered offsets within the roof footprint, keyed by a string seed. */
function scatterFor(seed: string, count: number, w: number, d: number) {
  let s = 0
  for (let i = 0; i < seed.length; i++) s = (s * 31 + seed.charCodeAt(i)) >>> 0
  const rand = () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
  return Array.from({ length: count }, () => ({
    x: (rand() - 0.5) * w * 0.6,
    z: (rand() - 0.5) * d * 0.6,
  }))
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

/** A digital-twin-style office/warehouse block: windowed facade + flat membrane roof + parapet. */
function BuildingModel({
  width,
  depth,
  buildingType,
}: {
  width: number
  depth: number
  buildingType: string
}) {
  const stories = STORIES_BY_TYPE[buildingType] ?? 4
  const floorHeight = 0.42
  const bodyHeight = stories * floorHeight
  const facadeTex = useFacadeTexture(stories)

  return (
    <group>
      {/* Building body */}
      <mesh position={[0, bodyHeight / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[width, bodyHeight, depth]} />
        <meshStandardMaterial attach="material-0" map={facadeTex} roughness={0.7} />
        <meshStandardMaterial attach="material-1" map={facadeTex} roughness={0.7} />
        <meshStandardMaterial attach="material-2" color={COLORS.roofMembrane} roughness={0.95} />
        <meshStandardMaterial attach="material-3" color={COLORS.facadeDark} roughness={1} />
        <meshStandardMaterial attach="material-4" map={facadeTex} roughness={0.7} />
        <meshStandardMaterial attach="material-5" map={facadeTex} roughness={0.7} />
      </mesh>

      {/* Roof slab (membrane) */}
      <mesh position={[0, bodyHeight + 0.04, 0]} receiveShadow castShadow>
        <boxGeometry args={[width * 1.02, 0.08, depth * 1.02]} />
        <meshStandardMaterial color={COLORS.roofMembrane} roughness={0.95} />
      </mesh>

      {/* Parapet rim so the roof reads as a distinct plane to place features on */}
      <mesh position={[0, bodyHeight + 0.16, 0]}>
        <boxGeometry args={[width * 1.02, 0.16, depth * 1.02]} />
        <meshStandardMaterial color={COLORS.parapet} roughness={0.9} wireframe />
      </mesh>
    </group>
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
  option: ScoredOption
  isTop: boolean
  position: [number, number, number]
}) {
  const meta = OPTION_ICON[option.id] ?? { icon: Leaf, color: '#22c55e' }
  const Icon = meta.icon
  return (
    <Html position={position} center distanceFactor={9} zIndexRange={[10, 0]}>
      <div className="flex flex-col items-center gap-1">
        <span
          className={`flex h-7 w-7 items-center justify-center rounded-full border-2 shadow-lg ${
            isTop ? 'border-canopy-green' : 'border-white/80'
          }`}
          style={{ backgroundColor: meta.color }}
        >
          <Icon className="h-3.5 w-3.5 text-black/80" />
        </span>
        <span className="whitespace-nowrap rounded bg-black/75 px-1.5 py-0.5 text-[10px] font-medium text-white shadow">
          {isTop ? `★ ${option.name}` : option.name}
        </span>
      </div>
    </Html>
  )
}

function ScanningPin({ position }: { position: [number, number, number] }) {
  return (
    <Html position={position} center distanceFactor={9} zIndexRange={[10, 0]}>
      <div className="flex items-center gap-1.5 whitespace-nowrap rounded bg-black/75 px-2 py-1 text-[11px] text-white shadow">
        <Loader2 className="h-3 w-3 animate-spin text-canopy-green" />
        Scanning roof for opportunities…
      </div>
    </Html>
  )
}

function Scene() {
  const building = useMapStore((s) => s.selectedBuilding)
  const solar = useAnalysisStore((s) => s.solar)
  const result = useAnalysisStore((s) => s.result)
  if (!building) return null

  const roofAreaSqFt = solar?.roofAreaSqFt ?? building.roofAreaSqFt

  const { width, depth } = useMemo(
    () => footprintFor(roofAreaSqFt, building.buildingType),
    [roofAreaSqFt, building.buildingType],
  )
  const stories = STORIES_BY_TYPE[building.buildingType] ?? 4
  const bodyHeight = stories * 0.42

  const featureOptions = result ? result.rankedOptions.slice(0, 4) : []
  const points = useMemo(
    () => scatterFor(building.id, Math.max(featureOptions.length, 1), width, depth),
    [building.id, width, depth, featureOptions.length],
  )

  return (
    <>
      <ambientLight intensity={0.65} />
      <directionalLight position={[6, 9, 4]} intensity={1.5} castShadow />
      <BuildingModel width={width} depth={depth} buildingType={building.buildingType} />

      {featureOptions.length > 0 ? (
        featureOptions.map((opt, i) => (
          <RoofFeaturePin
            key={opt.id}
            option={opt}
            isTop={i === 0}
            position={[points[i].x, bodyHeight + 0.45, points[i].z]}
          />
        ))
      ) : (
        <ScanningPin position={[0, bodyHeight + 0.45, 0]} />
      )}

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
        minDistance={5}
        maxDistance={16}
        minPolarAngle={0.4}
        maxPolarAngle={1.3}
        target={[0, bodyHeight / 2, 0]}
        autoRotate
        autoRotateSpeed={0.5}
      />
    </>
  )
}

function StatChip({
  icon: Icon,
  color,
  label,
  value,
}: {
  icon: typeof Ruler
  color: string
  label: string
  value: string
}) {
  return (
    <div className="flex min-w-[100px] flex-col gap-1 rounded-lg px-3 py-2">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-canopy-muted">
        <Icon className="h-3 w-3" style={{ color }} />
        {label}
      </div>
      <p className="font-mono text-sm font-semibold text-canopy-text">{value}</p>
    </div>
  )
}

function Legend() {
  const building = useMapStore((s) => s.selectedBuilding)
  const solar = useAnalysisStore((s) => s.solar)
  const result = useAnalysisStore((s) => s.result)
  if (!building) return null

  const roofAreaSqFt = solar?.roofAreaSqFt ?? building.roofAreaSqFt
  const sunHrs = solar?.sunExposureHrsPerDay ?? building.sunExposureHrsPerDay

  return (
    <div className="absolute bottom-4 left-4 z-10 flex gap-1 rounded-xl border border-canopy-border bg-canopy-surface/95 p-2 shadow-2xl backdrop-blur">
      <StatChip icon={Ruler} color="#f59e0b" label="Roof Area" value={`${roofAreaSqFt.toLocaleString()} ft²`} />
      <StatChip icon={Sun} color="#38bdf8" label="Sun" value={`${sunHrs} hrs/day`} />
      <StatChip icon={Thermometer} color="#ef4444" label="Heat Island" value={`+${building.heatIslandIntensityF}°F`} />
      {result ? (
        <StatChip icon={Trophy} color="#22c55e" label="Top Pick" value={result.rankedOptions[0].name} />
      ) : (
        <StatChip icon={Droplets} color="#a78bfa" label="Stormwater" value={`$${building.annualStormwaterCreditDollars.toLocaleString()}/yr`} />
      )}
    </div>
  )
}

export default function BuildingScene3D() {
  const building = useMapStore((s) => s.selectedBuilding)
  if (!building) return null

  return (
    <div className="relative h-full w-full bg-canopy-bg">
      <Canvas shadows camera={{ position: [8, 6.5, 8], fov: 36 }} dpr={[1, 2]}>
        <color attach="background" args={['#0a1a0f']} />
        <Suspense fallback={null}>
          <Scene />
          <Environment preset="city" />
        </Suspense>
      </Canvas>
      <div className="pointer-events-none absolute left-4 top-4 z-10 max-w-[260px] truncate rounded-lg border border-canopy-border bg-canopy-surface/90 px-3 py-2 text-xs text-canopy-muted backdrop-blur">
        {building.name} · digital twin
      </div>
      <Legend />
    </div>
  )
}
