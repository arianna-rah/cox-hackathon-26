import type { Building, UserPreferences, ScoredOption, CommunityBonus } from '@/types'
import { ROOF_OPTIONS } from './options'
import { ATLANTA } from './constants'
import { NEIGHBOR_BUILDINGS } from './buildings'

export function scoreAndRankOptions(b: Building, p: UserPreferences): ScoredOption[] {
  return ROOF_OPTIONS.map((o) => {
    const feasible = o.structuralLoadPSF <= b.maxLoadPSF
    const cost = o.costFixed ?? (o.costPerSqFt ?? 0) * b.roofAreaSqFt
    const net = (o.annualSavingsFixed ?? (o.annualSavingsPerSqFt ?? 0) * b.roofAreaSqFt) + (o.annualRevenueFixed ?? 0)
    const roi = net <= 0 ? 999 : Math.round((cost / net) * 12)
    const co2 = o.co2TonsPerYear ?? (o.co2TonsPerSqFtPerYear ?? 0) * b.roofAreaSqFt
    const score =
      Math.max(0, 100 - (roi / 48) * 100)      * (p.costSensitivity * 0.35) +
      Math.min(100, co2 * 4)                    * ((1 - p.costSensitivity) * 0.30) +
      (feasible ? o.feasibilityBase : o.feasibilityBase * 0.2) * 0.20 +
      (cost <= p.budgetDollars ? 100 : Math.max(0, 100 - ((cost - p.budgetDollars) / p.budgetDollars) * 100)) * 0.15
    const warningsForBuilding = [...o.warningFlags]
    if (!feasible) warningsForBuilding.unshift(
      `⚠ Building max load (${b.maxLoadPSF} lbs/sq ft) is below requirement (${o.structuralLoadPSF} lbs/sq ft)`
    )
    return { ...o, score, feasible, uptrontCost: cost, annualNetDollars: net, roiMonths: roi, warningsForBuilding }
  }).sort((a, z) => z.score - a.score)
}

export function calculateCommunityBonus(b: Building): CommunityBonus {
  const neighbors = b.neighborIds.map((id) => NEIGHBOR_BUILDINGS[id]).filter(Boolean)
  const count = neighbors.length + 1
  return {
    neighborCount: neighbors.length,
    bulkDiscountPct: count >= 3 ? 0.12 : count >= 2 ? 0.07 : 0,
    pooledStormwaterDollarsPerYear: b.annualStormwaterCreditDollars + neighbors.reduce((s, n) => s + (n?.annualStormwaterCreditDollars ?? 0), 0),
    heatReductionF: count * 1.6,
    cityGrantEligible: count >= ATLANTA.greenBlockMinBuildings,
    cityGrantDollars: count >= ATLANTA.greenBlockMinBuildings ? ATLANTA.cityGreenBlockGrantTotal : 0,
  }
}
