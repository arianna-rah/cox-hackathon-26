import type { Building, UserPreferences, ScoredOption, CommunityBonus } from '@/types'
import { ROOF_OPTIONS } from './options'
import { ATLANTA } from './constants'
import { NEIGHBOR_BUILDINGS } from './buildings'
import type { SolarData } from './solar'

/**
 * Real solar economics from measured Google Solar data + real Atlanta rates.
 *   cost    = installed $/watt × measured capacity, minus the 30% federal ITC
 *   savings = measured kWh/yr × real electricity rate
 *   co2     = measured kWh/yr × this grid's carbon intensity
 * No $/sq ft guesses — everything scales off measured production.
 */
export function realSolarEconomics(solar: SolarData) {
  const grossCost = solar.totalCapacityWatts * ATLANTA.solarInstalledCostPerWatt
  const upfrontCost = Math.round(grossCost * (1 - ATLANTA.federalITC))
  const annualSavings = Math.round(solar.annualKwh * ATLANTA.electricityRateDollarsPerKwh)
  const co2Tons = (solar.annualKwh * solar.carbonOffsetFactorKgPerMwh) / 1_000_000
  const roiMonths = annualSavings > 0 ? Math.round((upfrontCost / annualSavings) * 12) : 999
  return { upfrontCost, annualSavings, co2Tons, roiMonths, annualKwh: solar.annualKwh }
}

export function scoreAndRankOptions(
  b: Building,
  p: UserPreferences,
  solar?: SolarData | null,
): ScoredOption[] {
  // Prefer the Google-measured roof area when available.
  const roofArea = solar?.roofAreaSqFt ?? b.roofAreaSqFt
  return ROOF_OPTIONS.map((o) => {
    const feasible = o.structuralLoadPSF <= b.maxLoadPSF
    let cost = o.costFixed ?? (o.costPerSqFt ?? 0) * roofArea
    let net = (o.annualSavingsFixed ?? (o.annualSavingsPerSqFt ?? 0) * roofArea) + (o.annualRevenueFixed ?? 0)
    let co2 = o.co2TonsPerYear ?? (o.co2TonsPerSqFtPerYear ?? 0) * roofArea
    let annualKwh: number | undefined
    let isReal = false

    // The solar option uses real measured data when we have it.
    if (o.id === 'solar' && solar) {
      const e = realSolarEconomics(solar)
      cost = e.upfrontCost
      net = e.annualSavings
      co2 = e.co2Tons
      annualKwh = e.annualKwh
      isReal = true
    }

    const roi = net <= 0 ? 999 : Math.round((cost / net) * 12)
    const score =
      Math.max(0, 100 - (roi / 48) * 100)      * (p.costSensitivity * 0.35) +
      Math.min(100, co2 * 4)                    * ((1 - p.costSensitivity) * 0.30) +
      (feasible ? o.feasibilityBase : o.feasibilityBase * 0.2) * 0.20 +
      (cost <= p.budgetDollars ? 100 : Math.max(0, 100 - ((cost - p.budgetDollars) / p.budgetDollars) * 100)) * 0.15
    const warningsForBuilding = [...o.warningFlags]
    if (!feasible) warningsForBuilding.unshift(
      `⚠ Building max load (${b.maxLoadPSF} lbs/sq ft) is below requirement (${o.structuralLoadPSF} lbs/sq ft)`
    )
    return { ...o, score, feasible, uptrontCost: cost, annualNetDollars: net, roiMonths: roi, co2TonsPerYear: co2, annualKwh, isReal, warningsForBuilding }
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
