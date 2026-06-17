import type { Building, UserPreferences, ScoredOption, CommunityBonus } from '@/types'
import { ROOF_OPTIONS } from './options'
import { ATLANTA } from './constants'
import { NEIGHBOR_BUILDINGS } from './buildings'
import type { SolarData } from './solar'

// Commercial electricity-use intensity (kWh per sq ft of floor area per year),
// rounded from EIA CBECS 2018, Table C15 (Electricity consumption & intensity
// by principal building activity):
//   https://www.eia.gov/consumption/commercial/data/2018/ce/pdf/c15.pdf
// 'residential' is NOT a CBECS activity (CBECS is commercial only) — that value
// is an approximate multifamily figure. Used only to estimate a building's
// annual electricity use when the owner hasn't entered their real bill.
const ELECTRICITY_EUI_KWH_SQFT: Record<string, number> = {
  office: 17,
  retail: 14,
  warehouse: 5,
  residential: 9,
}
// Conservative floor-count assumptions for the energy estimate. Kept modest
// (we can't know a searched building's real height), so we don't overstate use.
const FLOORS_BY_TYPE: Record<string, number> = {
  office: 3,
  retail: 2,
  warehouse: 2,
  residential: 3,
}

const ENERGY_SAVING_IDS = new Set(['cool-roof', 'green-roof-extensive', 'green-roof-intensive'])

export interface OptionEnergyImpact {
  buildingAnnualKwh: number          // whole-building electricity use
  usingActual: boolean               // true = from the owner's entered bill, not modeled
  optionKwh: number | null           // kWh the option produces (solar) or saves (HVAC)
  offsetPct: number | null           // optionKwh as a % of building use
  annualDollars: number              // $/yr benefit (savings or revenue)
  kind: 'production' | 'savings' | 'revenue' | 'stormwater'
}

/** Convert an average monthly electric bill ($) to annual kWh at the local rate. */
export function billToAnnualKwh(monthlyBill: number): number {
  return Math.round((monthlyBill * 12) / ATLANTA.electricityRateDollarsPerKwh)
}

/**
 * Estimate the building's annual electricity use and the recommended option's
 * energy impact. Works for ANY option, not just solar:
 *   solar      → energy produced (real measured kWh)
 *   cool/green → cooling energy saved (dollars saved ÷ rate)
 *   beekeeping → revenue (no energy offset)
 *   rainwater  → stormwater savings (no energy offset)
 * Building use is the owner's real figure when `overrideAnnualKwh` is given,
 * else modeled (floor area × CBECS intensity).
 */
export function optionEnergyImpact(
  b: Building,
  option: ScoredOption | null,
  solar?: SolarData | null,
  overrideAnnualKwh?: number | null,
): OptionEnergyImpact {
  const roofArea = solar?.roofAreaSqFt ?? b.roofAreaSqFt
  const floors = FLOORS_BY_TYPE[b.buildingType] ?? 3
  const eui = ELECTRICITY_EUI_KWH_SQFT[b.buildingType] ?? 14
  const usingActual = overrideAnnualKwh != null && overrideAnnualKwh > 0
  const buildingAnnualKwh = usingActual
    ? Math.round(overrideAnnualKwh as number)
    : Math.round(roofArea * floors * eui)
  const annualDollars = option ? Math.round(option.annualNetDollars) : 0

  let optionKwh: number | null = null
  let kind: OptionEnergyImpact['kind'] = 'savings'

  if (option?.id === 'solar') {
    kind = 'production'
    optionKwh = solar?.annualKwh ?? option.annualKwh ?? null
  } else if (option && ENERGY_SAVING_IDS.has(option.id)) {
    kind = 'savings'
    // These options save HVAC/energy dollars; convert back to kWh avoided.
    optionKwh = annualDollars > 0 ? Math.round(annualDollars / ATLANTA.electricityRateDollarsPerKwh) : null
  } else if (option?.id === 'rainwater') {
    kind = 'stormwater'
  } else if (option?.id === 'beekeeping') {
    kind = 'revenue'
  }

  const offsetPct =
    optionKwh != null && buildingAnnualKwh > 0
      ? Math.min(100, Math.round((optionKwh / buildingAnnualKwh) * 100))
      : null

  return { buildingAnnualKwh, usingActual, optionKwh, offsetPct, annualDollars, kind }
}

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

/**
 * Returns true when the building has a flat or low-slope roof suitable for
 * green roofs, beekeeping, cisterns, etc.
 */
function isFlatRoof(b: Building, solar?: SolarData | null): boolean {
  if (solar?.roofPlanes && solar.roofPlanes.length > 0) {
    const sorted = [...solar.roofPlanes].sort((a, z) => z.areaM2 - a.areaM2)
    const top = sorted.slice(0, Math.min(3, sorted.length))
    const totalArea = top.reduce((s, p) => s + p.areaM2, 0)
    const weightedPitch = totalArea > 0
      ? top.reduce((s, p) => s + p.pitchDeg * (p.areaM2 / totalArea), 0)
      : top[0].pitchDeg
    return weightedPitch < 15
  }
  const rt = b.roofType.toLowerCase()
  if (/pitch|gable|hip|shed|gambrel|mansard|barrel|slope/i.test(rt)) return false
  if (/flat|membrane|tpo|epdm|modified|built-up|bur|gravel/i.test(rt)) return true
  return b.buildingType !== 'residential'
}

export function scoreAndRankOptions(
  b: Building,
  p: UserPreferences,
  solar?: SolarData | null,
): ScoredOption[] {
  // Prefer the Google-measured roof area when available.
  const roofArea = solar?.roofAreaSqFt ?? b.roofAreaSqFt
  const flatRoof = isFlatRoof(b, solar)

  return ROOF_OPTIONS.map((o) => {
    const structurallyFeasible = o.structuralLoadPSF <= b.maxLoadPSF
    // Flat-roof-only options are not applicable on pitched or inaccessible roofs.
    const roofTypeFeasible = !o.requiresFlatRoof || flatRoof
    // Beekeeping requires an accessible flat roof at manageable height AND a
    // structurally decent building (maxLoadPSF >= 10 as a loose proxy).
    // Office buildings are typically multi-story — without knowing the actual
    // floor count we can't safely recommend hive management on a high-rise roof.
    const beekeepingAccessible =
      o.id !== 'beekeeping' ||
      (b.maxLoadPSF >= 10 &&
        (b.buildingType === 'warehouse' ||
          b.buildingType === 'retail' ||
          (b.buildingType === 'residential' && flatRoof)))
    const feasible = structurallyFeasible && roofTypeFeasible && beekeepingAccessible

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
    const feasibilityFactor = feasible ? o.feasibilityBase : o.feasibilityBase * 0.2
    const score =
      Math.max(0, 100 - (roi / 48) * 100)      * (p.costSensitivity * 0.35) +
      Math.min(100, co2 * 4)                    * ((1 - p.costSensitivity) * 0.30) +
      feasibilityFactor                          * 0.20 +
      (cost <= p.budgetDollars ? 100 : Math.max(0, 100 - ((cost - p.budgetDollars) / p.budgetDollars) * 100)) * 0.15

    const warningsForBuilding = [...o.warningFlags]
    if (!structurallyFeasible) warningsForBuilding.unshift(
      `⚠ Building max load (${b.maxLoadPSF} lbs/sq ft) is below requirement (${o.structuralLoadPSF} lbs/sq ft)`
    )
    if (!roofTypeFeasible) warningsForBuilding.unshift(
      `⚠ Requires a flat or low-slope roof — this building's roof type makes ${o.name} impractical`
    )
    if (!beekeepingAccessible) warningsForBuilding.unshift(
      `⚠ Rooftop beekeeping requires a safe, accessible flat roof on a low-rise building (≤ ~6 stories) — hive management and carrying honey supers (50+ lbs) at height is unsafe and may violate OSHA fall-protection rules`
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
