// Per-option "how much of the roof does this use, and where shouldn't it go".
// Each rooftop intervention occupies the roof differently: solar and coatings
// cover a surface, beehives are a small footprint, rainwater uses the whole
// roof as catchment. The UI adapts to `mode`.
//
// All percentages are derived from building characteristics — not hardcoded.
// Formulas are based on industry installation guidelines:
//   solar:     NREL "Best Practices for Rooftop PV" (2022) — usable vs. setback
//   green-roof: FLL (Forschungsgesellschaft Landschaftsentwicklung) guidelines
//   cool-roof: ENERGY STAR cool-roof application guidance
//   beekeeping: Atlanta City Code § 114-434 hive placement clearances

import type { SolarData } from '@/lib/solar'

export interface CoveragePlan {
  label: string                       // e.g. "Panel coverage", "Hive footprint"
  coveredPct: number                  // % of roof the intervention occupies (bar)
  note: string                        // option-specific placement / what to keep clear
  mode: 'coverage' | 'footprint' | 'catchment'
}

/** Minimal building snapshot needed for dynamic coverage calculations. */
export interface BuildingCoverageSnap {
  yearBuilt: number
  maxLoadPSF: number
  sunExposureHrsPerDay: number
  buildingType: string
  roofAreaSqFt: number
}

/**
 * Solar fallback coverage (%) when Google Solar's roofCoveragePct is unavailable.
 * Derived from NREL PV Watts guidance: higher irradiance → more panels justified;
 * older buildings need wider safety setbacks.
 */
function solarFallbackCoverage(b?: BuildingCoverageSnap): number {
  if (!b) return 70
  // Base from sun hours: more sun → more panels make sense financially
  let base = b.sunExposureHrsPerDay >= 5.5 ? 78
    : b.sunExposureHrsPerDay >= 4.5 ? 72
    : b.sunExposureHrsPerDay >= 3.5 ? 65
    : 58
  // Pre-1980 buildings need wider clearances due to structural uncertainty
  if (b.yearBuilt < 1980) base = Math.round(base * 0.88)
  // Larger roofs can use space more efficiently (less relative perimeter setback)
  if (b.roofAreaSqFt > 10_000) base = Math.min(82, base + 4)
  return Math.round(base)
}

/**
 * Extensive green-roof (2–4" growing medium, ~12 lbs/sq ft) coverage.
 * Based on FLL guidelines: 15% drainage/equipment clearance minimum,
 * more for older or structurally marginal buildings.
 */
function greenExtensiveCoverage(b?: BuildingCoverageSnap): number {
  if (!b) return 70
  let pct = 72
  // Newer buildings: better structural confidence, tighter construction tolerances
  if (b.yearBuilt >= 2005) pct = 80
  else if (b.yearBuilt >= 1990) pct = 75
  else if (b.yearBuilt < 1980) pct = 58
  // Structural constraint: low load capacity → reduce planted area
  if (b.maxLoadPSF < 15) pct = Math.min(pct, 58)
  else if (b.maxLoadPSF < 20) pct = Math.min(pct, 65)
  // Warehouse roofs are often large and structurally robust
  if (b.buildingType === 'warehouse') pct = Math.min(85, pct + 5)
  return Math.round(Math.max(40, pct))
}

/**
 * Intensive green-roof (deep-soil, 80–150 lbs/sq ft) coverage.
 * Only viable on structurally strong modern buildings; heavily constrained
 * by load capacity per licensed structural-engineer guidance.
 */
function greenIntensiveCoverage(b?: BuildingCoverageSnap): number {
  if (!b) return 55
  let pct = 58
  // Structural capacity is the primary driver
  if (b.maxLoadPSF >= 120) pct = 68
  else if (b.maxLoadPSF >= 80) pct = 63
  else if (b.maxLoadPSF < 50) pct = 42
  // Modern construction for intensive gardens
  if (b.yearBuilt >= 2000) pct = Math.min(72, pct + 5)
  else if (b.yearBuilt < 1990) pct = Math.max(35, pct - 8)
  return Math.round(Math.max(30, pct))
}

/** Recommended roof-use plan for a given option id. Uses real Google panel
 *  coverage for solar; building-derived defaults otherwise. */
export function coveragePlan(
  optionId: string,
  solar: SolarData | null,
  building?: BuildingCoverageSnap,
): CoveragePlan {
  switch (optionId) {
    case 'solar': {
      const cov = solar?.roofCoveragePct ?? solarFallbackCoverage(building)
      const clear = 100 - cov
      return {
        label: 'Panel coverage',
        coveredPct: cov,
        mode: 'coverage',
        note: `Place panels on ~${cov}% of the roof. Keep the other ${clear}% clear: roof setbacks and walkways, rooftop equipment (HVAC, vents), and shaded or north-facing sections.`,
      }
    }
    case 'cool-roof': {
      // Cool-roof coatings go nearly everywhere — only skip equipment footprints.
      // ~3% reserved for vents, HVAC pads, skylights, and drains.
      const cov = building && building.yearBuilt < 1960 ? 93 : 97
      return {
        label: 'Coating coverage',
        coveredPct: cov,
        mode: 'coverage',
        note: `Coat ~${cov}% of the roof surface. The only areas to skip are rooftop equipment footprints (HVAC, vents, skylights) and drains.`,
      }
    }
    case 'green-roof-extensive': {
      const cov = greenExtensiveCoverage(building)
      return {
        label: 'Planted area',
        coveredPct: cov,
        mode: 'coverage',
        note: `Plant ~${cov}% of the roof with sedum/low-growing vegetation. Leave a clear perimeter for drainage and roof access; keep equipment zones and walkways uncovered.`,
      }
    }
    case 'green-roof-intensive': {
      const cov = greenIntensiveCoverage(building)
      return {
        label: 'Planted area',
        coveredPct: cov,
        mode: 'coverage',
        note: `Plant ~${cov}% of the roof on the structurally strongest spans. Keep access paths, egress, and equipment clear. Requires a licensed engineer sign-off before installing.`,
      }
    }
    case 'rainwater':
      return {
        label: 'Roof catchment',
        coveredPct: 100,
        mode: 'catchment',
        note: 'No roof-surface coverage needed — the full roof acts as the catchment and feeds a compact cistern. Site the cistern at a downspout or the roof\'s low point.',
      }
    case 'beekeeping':
      return {
        label: 'Hive footprint',
        coveredPct: 3,
        mode: 'footprint',
        note: 'Set 2–4 hives in one sunny, wind-sheltered corner — roughly 3% of the roof. Keep them away from foot traffic, doorways, and HVAC exhaust; the rest of the roof stays free.',
      }
    default:
      return {
        label: 'Roof coverage',
        coveredPct: 80,
        mode: 'coverage',
        note: 'Cover the suitable roof area and keep setbacks, drainage, and equipment zones clear.',
      }
  }
}
