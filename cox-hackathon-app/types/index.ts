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
  includeCommunity: boolean     // include block-level Green Block benefits
  // Optional: owner's average monthly electric bill ($). When provided we use
  // it for real building energy use instead of the modeled estimate.
  monthlyElectricBill: number | null
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

// ─────────────────────────────────────────
// Gemini dashboard analysis (the final answer page).
// Mirrors the backend dashboardAnalysis JSON. Numbers may be null when a value
// isn't available; the UI renders "—" in that case.
// ─────────────────────────────────────────

export interface DashRecommendedOption {
  name: string
  category: string
  shortHeadline: string
  whyThisWins: string
  confidenceLabel: string
  feasibilityLabel: string
  primaryReason: string
}

export interface DashKeyMetrics {
  upfrontCost: number | null
  netCostAfterIncentives: number | null
  annualSavings: number | null
  paybackYears: number | null
  roiPercent: number | null
  co2ReductionPerYear: number | null
  tenYearValue: number | null
  twentyYearValue: number | null
}

export interface DashRoofSummary {
  address: string
  roofArea: number | null
  usableRoofArea: number | null
  solarPotential: string
  sunlightSummary: string
  structuralNotes: string
  dataConfidence: string
}

export interface DashFinancialBreakdown {
  grossCost: number | null
  rebates: number | null
  communityDiscount: number | null
  grantValue: number | null
  estimatedMaintenanceCost: number | null
  netCost: number | null
  annualSavingsOrRevenue: number | null
  breakEvenExplanation: string
  investmentTimeline: string
}

export interface DashEnvironmentalImpact {
  co2ReductionPerYear: number | null
  lifetimeCo2Reduction: number | null
  stormwaterBenefit: string
  heatIslandBenefit: string
  biodiversityBenefit: string
  plainEnglishEquivalent: string
}

export interface DashComparisonRow {
  rank: number | null
  name: string
  upfrontCost: number | null
  netCostAfterIncentives: number | null
  annualSavings: number | null
  paybackYears: number | null
  roiPercent: number | null
  co2ReductionPerYear: number | null
  feasibility: string
  maintenanceLevel: string
  score: number | null
  summary: string
}

export interface DashCommunityImpact {
  individualImpact: string
  blockLevelImpact: string
  bulkDiscountSavings: number | null
  greenBlockGrantEligibility: string
  greenBlockGrantValue: number | null
  pooledStormwaterCredit: number | null
  neighborhoodCo2Reduction: number | null
  recommendation: string
}

export interface DashIncentive {
  name: string
  estimatedValue: number | null
  description: string
}

export interface DashIncentives {
  availableIncentives: DashIncentive[]
  estimatedTotalIncentiveValue: number | null
  notes: string
}

export interface DashRisk {
  title: string
  severity: 'Low' | 'Medium' | 'High' | string
  explanation: string
}

export interface DashNextStep {
  step: string
  description: string
}

/** One element of the recommended roof plan — becomes a clickable 3D widget. */
export interface DashPlanComponent {
  optionId: string          // matches ScoredOption.id (drives the 3D widget icon)
  name: string              // e.g. "Rooftop Solar"
  coveragePct: number       // share of the roof this uses (0–100)
  upfrontCost: number | null
  annualBenefit: string     // short benefit line ($ saved/yr, or social/biodiversity)
  implementation: string    // how it's implemented on this roof (a few sentences)
}

/**
 * The single recommended strategy for the roof — may combine several options
 * (e.g. solar + a pollinator garden). `components` are the only things that
 * appear as widgets on the 3D model.
 */
export interface DashRoofPlan {
  strategyName: string      // e.g. "Solar + Pollinator Garden"
  summary: string           // short project description
  components: DashPlanComponent[]
  changeablePct: number     // % of the roof that can be changed/used
  unusablePct: number       // % that stays unusable
  unusableReason: string    // why (setbacks, HVAC, shading, structural, …)
}

export interface DashboardAnalysis {
  plan?: DashRoofPlan | null
  recommendedOption: DashRecommendedOption
  keyMetrics: DashKeyMetrics
  roofSummary: DashRoofSummary
  financialBreakdown: DashFinancialBreakdown
  environmentalImpact: DashEnvironmentalImpact
  optionComparison: DashComparisonRow[]
  communityImpact: DashCommunityImpact
  incentives: DashIncentives
  risksAndTradeoffs: DashRisk[]
  nextSteps: DashNextStep[]
  advisorSummary: string
  assumptions: string[]
  /** Where the content came from, for a small UI badge. */
  source?: 'gemini' | 'fallback'
}
