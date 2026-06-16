// Per-option "how much of the roof does this use, and where shouldn't it go".
// Each rooftop intervention occupies the roof differently: solar and coatings
// cover a surface, beehives are a small footprint, rainwater uses the whole
// roof as catchment. The UI adapts to `mode`.

import type { SolarData } from '@/lib/solar'

export interface CoveragePlan {
  label: string                       // e.g. "Panel coverage", "Hive footprint"
  coveredPct: number                  // % of roof the intervention occupies (bar)
  note: string                        // option-specific placement / what to keep clear
  mode: 'coverage' | 'footprint' | 'catchment'
}

/** Recommended roof-use plan for a given option id. Uses real Google panel
 *  coverage for solar; sensible per-option defaults otherwise. */
export function coveragePlan(optionId: string, solar: SolarData | null): CoveragePlan {
  switch (optionId) {
    case 'solar': {
      const cov = solar?.roofCoveragePct ?? 70
      return {
        label: 'Panel coverage',
        coveredPct: cov,
        mode: 'coverage',
        note: `Place panels on ~${cov}% of the roof. Keep the other ${100 - cov}% clear: roof setbacks and walkways, rooftop equipment (HVAC, vents), and shaded or north-facing sections.`,
      }
    }
    case 'cool-roof':
      return {
        label: 'Coating coverage',
        coveredPct: 97,
        mode: 'coverage',
        note: 'Coat nearly the entire roof surface. The only areas to skip are rooftop equipment footprints (HVAC, vents, skylights) and drains.',
      }
    case 'green-roof-extensive':
      return {
        label: 'Planted area',
        coveredPct: 70,
        mode: 'coverage',
        note: 'Plant ~70% of the roof. Leave a clear perimeter for drainage and roof access, and keep equipment zones and walkways uncovered.',
      }
    case 'green-roof-intensive':
      return {
        label: 'Planted area',
        coveredPct: 60,
        mode: 'coverage',
        note: 'Plant ~60% of the roof on the structurally strongest spans. Keep access paths, egress, and equipment clear. Requires a licensed engineer sign-off before installing.',
      }
    case 'rainwater':
      return {
        label: 'Roof catchment',
        coveredPct: 100,
        mode: 'catchment',
        note: 'No roof-surface coverage needed — the full roof acts as the catchment and feeds a compact cistern. Site the cistern at a downspout or the roof’s low point.',
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
