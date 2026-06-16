export interface Building {
  id: string
  name: string
  address: string
  lat: number
  lng: number
  yearBuilt: number
  buildingType: 'warehouse' | 'residential' | 'office' | 'retail'
  roofAreaSqFt: number
  roofType: string
  roofMaterial: string
  maxLoadPSF: number
  sunExposureHrsPerDay: number
  heatIslandIntensityF: number
  annualStormwaterCreditDollars: number
  neighborIds: string[]
  precomputedSolarKwhPerYear: number
}

export interface UserPreferences {
  budgetDollars: number
  costSensitivity: number       // 0 = max impact, 1 = fastest ROI
  primaryGoal: 'savings' | 'revenue' | 'environment' | 'community'
}

export interface RoofOption {
  id: string
  name: string
  shortDescription: string
  fullDescription: string
  costPerSqFt?: number
  costFixed?: number
  annualSavingsPerSqFt?: number
  annualSavingsFixed?: number
  annualRevenueFixed?: number
  co2TonsPerSqFtPerYear?: number
  co2TonsPerYear?: number
  structuralLoadPSF: number
  feasibilityBase: number
  rebates: string[]
  warningFlags: string[]
  bestFor: string
}

export interface ScoredOption extends RoofOption {
  score: number
  feasible: boolean
  uptrontCost: number
  annualNetDollars: number
  roiMonths: number
  warningsForBuilding: string[]
  isReal?: boolean        // numbers derived from live Google Solar data
  annualKwh?: number      // measured annual production (solar option only)
}

export interface CommunityBonus {
  neighborCount: number
  bulkDiscountPct: number
  pooledStormwaterDollarsPerYear: number
  heatReductionF: number
  cityGrantEligible: boolean
  cityGrantDollars: number
}

export interface AnalysisResult {
  building: Building
  preferences: UserPreferences
  rankedOptions: ScoredOption[]
  communityBonus: CommunityBonus
}

export type SidebarStep = 'closed' | 'info' | 'preferences' | 'analysis' | 'results'
