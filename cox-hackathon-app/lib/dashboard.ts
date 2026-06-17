// Deterministic fallback for the final dashboard.
//
// When the backend (Google Solar → scorer → Gemini) is reachable, the UI
// renders the Gemini-authored dashboardAnalysis. When it isn't — or Gemini
// fails — this builds the same DashboardAnalysis shape from the local scored
// options so the answer page never crashes and always shows a recommendation.

import type {
  Building,
  UserPreferences,
  ScoredOption,
  CommunityBonus,
  DashboardAnalysis,
  DashComparisonRow,
  DashRisk,
  DashRoofPlan,
  DashPlanComponent,
} from '@/types'
import type { SolarData } from '@/lib/solar'
import { ATLANTA } from '@/lib/constants'
import { coveragePlan } from '@/lib/coverage'

const clampPct = (n: number) => Math.min(100, Math.max(0, Math.round(n)))

// Options that occupy roof *surface* (vs. bees = footprint, rainwater = catchment).
// A meaningful retrofit requires at least one of these to be feasible.
const SURFACE_IDS = new Set([
  'solar',
  'cool-roof',
  'green-roof-extensive',
  'green-roof-intensive',
])

/** Short benefit line for a plan component (savings, revenue, or non-$ benefit). */
function benefitLine(o: ScoredOption): string {
  if (o.annualRevenueFixed && o.annualRevenueFixed > 0)
    return `~$${Math.round(o.annualRevenueFixed).toLocaleString()}/yr revenue`
  if (o.id === 'beekeeping') return 'Pollination + community engagement'
  if (o.id.includes('green')) return 'Cooling, stormwater & biodiversity'
  if (o.annualNetDollars > 0) return `~$${Math.round(o.annualNetDollars).toLocaleString()}/yr savings`
  return o.bestFor
}

function planComponent(o: ScoredOption, solar: SolarData | null): DashPlanComponent {
  const cov = coveragePlan(o.id, solar)
  return {
    optionId: o.id,
    name: o.name,
    coveragePct: clampPct(cov.coveredPct),
    upfrontCost: Math.round(o.uptrontCost),
    annualBenefit: benefitLine(o),
    implementation: cov.note,
  }
}

/**
 * Deterministic recommended plan — the single best strategy, optionally pairing
 * the top option with a complementary low-footprint one (e.g. solar + bees).
 * Used when Gemini is unavailable so the dashboard + 3D widgets always have a
 * coherent plan to show.
 */
export function buildFallbackPlan(
  building: Building,
  ranked: ScoredOption[],
  solar: SolarData | null,
): DashRoofPlan {
  const feasible = ranked.filter((o) => o.feasible)
  // A real retrofit needs a surface option (solar / coating / green roof). When
  // none is feasible, a tiny beehive footprint isn't a meaningful plan — report
  // that nothing substantial is doable rather than a contradictory 3%/100% split.
  const surfaceFeasible = feasible.filter((o) => SURFACE_IDS.has(o.id))
  if (surfaceFeasible.length === 0) {
    return {
      strategyName: 'No viable retrofit',
      summary: `This roof can't currently support a rooftop retrofit — structural load limits or roof condition rule out solar, cool-roof coatings, and green roofs. A structural review is the recommended first step before any rooftop project.`,
      components: [],
      changeablePct: 0,
      unusablePct: 100,
      unusableReason: 'Structural load limits and roof condition rule out surface interventions on this roof.',
    }
  }

  const primary = surfaceFeasible[0]
  const components: DashPlanComponent[] = [planComponent(primary, solar)]

  // A complementary piece that genuinely shares the roof without conflicting:
  // bees take a tiny corner; rainwater uses the roof as catchment, not surface.
  const complement = feasible.find(
    (o) =>
      o.id !== primary.id &&
      ((primary.id === 'solar' && (o.id === 'beekeeping' || o.id === 'rainwater')) ||
        (primary.id.includes('green') && o.id === 'beekeeping')),
  )
  if (complement) components.push(planComponent(complement, solar))

  // Allocation always sums to 100%: surface coverage + bee footprint + unusable.
  // Rainwater is a catchment (whole roof, no surface), so it's excluded from the
  // allocation maths. Reserve a minimum unusable share for equipment & setbacks.
  const minUnusable = building.yearBuilt < 1980 ? 15 : 8
  const beeComp = components.find((c) => c.optionId === 'beekeeping')
  const beePct = beeComp?.coveragePct ?? 0
  const surfaceComp = components.find((c) => SURFACE_IDS.has(c.optionId))!
  surfaceComp.coveragePct = clampPct(Math.min(surfaceComp.coveragePct, 100 - minUnusable - beePct))

  const usedPct = clampPct(surfaceComp.coveragePct + beePct)
  const unusablePct = clampPct(100 - usedPct)

  const reasons = ['rooftop HVAC, vents and equipment', 'roof setbacks, walkways and drainage']
  if (building.yearBuilt < 1980) reasons.push('structural load limits on this older roof')

  const names = components.map((c) => c.name)
  const strategyName =
    names.length > 1 ? `${names[0]} + ${names.slice(1).join(' + ')}` : names[0]

  return {
    strategyName,
    summary: `Convert ${building.name}'s roof with ${strategyName.toLowerCase()} — using the parts of the roof that are structurally and solar-suitable, while leaving equipment and access zones clear.`,
    components,
    changeablePct: usedPct,
    unusablePct,
    unusableReason: `Reserved for ${reasons.join(', ')}.`,
  }
}

const CARS_CO2_TONS_PER_YEAR = 4.6 // EPA: avg passenger vehicle, metric tons CO₂/yr

const META: Record<string, { category: string; maintenance: string }> = {
  'cool-roof': { category: 'Reflective Coating', maintenance: 'Low' },
  solar: { category: 'Solar', maintenance: 'Low' },
  'green-roof-extensive': { category: 'Green Infrastructure', maintenance: 'Medium' },
  'green-roof-intensive': { category: 'Green Infrastructure', maintenance: 'High' },
  rainwater: { category: 'Water Systems', maintenance: 'Low' },
  beekeeping: { category: 'Urban Agriculture', maintenance: 'Medium' },
}

function meta(id: string) {
  return META[id] ?? { category: 'Rooftop', maintenance: 'Medium' }
}

function feasibilityLabel(o: ScoredOption): string {
  if (!o.feasible) return 'Needs Inspection'
  if (o.feasibilityBase >= 85) return 'Strong Fit'
  if (o.feasibilityBase >= 60) return 'Moderate Fit'
  return 'Needs Inspection'
}

function paybackYears(o: ScoredOption): number | null {
  return o.roiMonths < 900 ? Math.round((o.roiMonths / 12) * 10) / 10 : null
}

function round(n: number): number {
  return Math.round(n)
}

/** Build a full DashboardAnalysis from deterministic scorer output. */
export function buildFallbackDashboard(
  building: Building,
  prefs: UserPreferences,
  ranked: ScoredOption[],
  community: CommunityBonus,
  solar: SolarData | null,
): DashboardAnalysis {
  const top = ranked[0]
  const includeCommunity = prefs.includeCommunity !== false
  const roofArea = solar?.roofAreaSqFt ?? building.roofAreaSqFt
  const sunHrs = solar?.sunExposureHrsPerDay ?? building.sunExposureHrsPerDay

  // ── Financials for the recommended option ──
  const grossCost = round(top.uptrontCost)
  const communityDiscount = includeCommunity ? round(community.bulkDiscountPct * grossCost) : 0
  const grantValue =
    includeCommunity && community.cityGrantEligible ? round(community.cityGrantDollars) : 0
  const netCost = Math.max(0, grossCost - communityDiscount - grantValue)
  const annualNet = round(top.annualNetDollars)
  const pay = paybackYears(top)
  const roiPercent = netCost > 0 && annualNet > 0 ? round((annualNet / netCost) * 100) : null
  const co2 = top.co2TonsPerYear != null ? Math.round(top.co2TonsPerYear * 10) / 10 : null
  const tenYear = round(annualNet * 10 - netCost)
  const twentyYear = round(annualNet * 20 - netCost)

  const timeline =
    pay == null ? 'Long-term' : pay <= 3 ? 'Short-term' : pay <= 8 ? 'Medium-term' : 'Long-term'

  const confidence = top.score >= 70 ? 'High confidence' : top.score >= 45 ? 'Moderate confidence' : 'Exploratory'

  const goalReason: Record<string, string> = {
    savings: 'the strongest operating-cost reduction for your budget',
    revenue: 'new revenue from otherwise-unused roof space',
    environment: 'the largest environmental impact per dollar',
    community: 'the best fit for a block-level Green Block plan',
  }
  const primaryReason =
    pay != null && pay <= 4
      ? `Fast payback (~${pay} yr) with ${annualNet >= 0 ? `$${annualNet.toLocaleString()}/yr` : 'positive'} return`
      : co2 && co2 >= 5
        ? `High CO₂ reduction (${co2} t/yr) while staying feasible on this roof`
        : `Best balance of cost, feasibility, and ${goalReason[prefs.primaryGoal] ?? 'impact'}`

  // ── Option comparison rows ──
  const optionComparison: DashComparisonRow[] = ranked.map((o, i) => {
    const oNet = includeCommunity
      ? Math.max(0, round(o.uptrontCost * (1 - community.bulkDiscountPct)))
      : round(o.uptrontCost)
    return {
      rank: i + 1,
      name: o.name,
      upfrontCost: round(o.uptrontCost),
      netCostAfterIncentives: oNet,
      annualSavings: round(o.annualNetDollars),
      paybackYears: paybackYears(o),
      roiPercent: oNet > 0 && o.annualNetDollars > 0 ? round((o.annualNetDollars / oNet) * 100) : null,
      co2ReductionPerYear: o.co2TonsPerYear != null ? Math.round(o.co2TonsPerYear * 10) / 10 : null,
      feasibility: feasibilityLabel(o),
      maintenanceLevel: meta(o.id).maintenance,
      score: round(o.score),
      summary: o.shortDescription,
    }
  })

  // ── Incentives ──
  const availableIncentives = [
    ...top.rebates.map((r) => ({ name: r, estimatedValue: null as number | null, description: '' })),
  ]
  if (communityDiscount > 0)
    availableIncentives.push({
      name: `Green Block bulk discount (${Math.round(community.bulkDiscountPct * 100)}%)`,
      estimatedValue: communityDiscount,
      description: 'Shared installation pricing when neighboring roofs join.',
    })
  if (grantValue > 0)
    availableIncentives.push({
      name: 'City of Atlanta Green Block grant',
      estimatedValue: grantValue,
      description: 'One-time grant for an eligible block-wide green plan.',
    })
  const incentiveTotal = communityDiscount + grantValue

  // ── Risks ──
  const risks: DashRisk[] = []

  // Warn if the building is so structurally limited that only the lightest options are feasible.
  const nonTrivialFeasible = ranked.some(
    (o) => o.feasible && o.id !== 'cool-roof' && o.id !== 'beekeeping',
  )
  if (!nonTrivialFeasible && building.maxLoadPSF < 12) {
    risks.push({
      title: 'Very limited structural capacity — few options viable',
      severity: 'High',
      explanation:
        `At ${building.maxLoadPSF} lbs/ft² this roof can only safely support Cool Roof Coating and Rooftop Beekeeping. ` +
        `Solar panels (4 lbs/ft²), green roofs (12–100 lbs/ft²), and cisterns (2 lbs/ft²) exceed the current limit. ` +
        `A licensed structural engineer would need to assess reinforcement options before any heavier installation.`,
    })
  }

  if (!top.feasible)
    risks.push({
      title: 'Structural load limitation',
      severity: 'High',
      explanation:
        top.warningsForBuilding[0] ??
        `This option exceeds the building's ${building.maxLoadPSF} lbs/ft² capacity — a structural review is required.`,
    })
  if (pay != null && pay > 10)
    risks.push({
      title: 'Long payback period',
      severity: pay > 15 ? 'High' : 'Medium',
      explanation: `Estimated payback is ~${pay} years; returns are realized over the long term.`,
    })
  if (grossCost > prefs.budgetDollars)
    risks.push({
      title: 'Exceeds stated budget',
      severity: 'Medium',
      explanation: `Gross cost ($${grossCost.toLocaleString()}) is above your $${prefs.budgetDollars.toLocaleString()} budget before incentives.`,
    })
  if (building.yearBuilt < 1980)
    risks.push({
      title: 'Roof age & structural uncertainty',
      severity: 'Medium',
      explanation: `Pre-1980 construction (${building.yearBuilt}) — confirm load capacity and roof condition before installing.`,
    })
  if (!solar)
    risks.push({
      title: 'Estimated rooftop data',
      severity: 'Low',
      explanation: 'Live satellite roof data was unavailable; figures use modeled estimates.',
    })
  risks.push({
    title: 'Professional inspection recommended',
    severity: 'Low',
    explanation: 'A licensed inspection confirms structural fit and final pricing before any install.',
  })

  const plainEnglish =
    co2 != null && co2 > 0
      ? `Equivalent to taking about ${round(co2 / CARS_CO2_TONS_PER_YEAR)} cars off the road every year.`
      : 'Environmental impact is modest for this option on this roof.'

  return {
    plan: buildFallbackPlan(building, ranked, solar),
    recommendedOption: {
      name: top.name,
      category: meta(top.id).category,
      shortHeadline: top.shortDescription,
      whyThisWins: `${top.name} ranks highest for ${building.name}. ${top.bestFor} For your goal of ${prefs.primaryGoal}, it delivers ${goalReason[prefs.primaryGoal] ?? 'the best overall balance'}${pay != null ? `, paying back in about ${pay} years` : ''}.`,
      confidenceLabel: confidence,
      feasibilityLabel: feasibilityLabel(top),
      primaryReason,
    },
    keyMetrics: {
      upfrontCost: grossCost,
      netCostAfterIncentives: netCost,
      annualSavings: annualNet,
      paybackYears: pay,
      roiPercent,
      co2ReductionPerYear: co2,
      tenYearValue: tenYear,
      twentyYearValue: twentyYear,
    },
    roofSummary: {
      address: building.address,
      roofArea,
      usableRoofArea: solar?.roofAreaSqFt ?? null,
      solarPotential: solar ? `${solar.annualKwh.toLocaleString()} kWh/yr potential` : 'Estimated from roof area',
      sunlightSummary: `${sunHrs} sun hours/day`,
      structuralNotes: `Max load ${building.maxLoadPSF} lbs/ft² · ${building.roofType} · ${building.roofMaterial}`,
      dataConfidence: solar ? 'High — live Google Solar measurements' : 'Moderate — modeled estimate',
    },
    financialBreakdown: {
      grossCost,
      rebates: null,
      communityDiscount: communityDiscount || null,
      grantValue: grantValue || null,
      estimatedMaintenanceCost: null,
      netCost,
      annualSavingsOrRevenue: annualNet,
      breakEvenExplanation:
        pay != null
          ? `At $${annualNet.toLocaleString()}/yr in savings, the $${netCost.toLocaleString()} net cost breaks even in roughly ${pay} years, then returns value every year after.`
          : `This option delivers long-term value rather than a fast cash payback.`,
      investmentTimeline: timeline,
    },
    environmentalImpact: {
      co2ReductionPerYear: co2,
      lifetimeCo2Reduction: co2 != null ? Math.round(co2 * 20 * 10) / 10 : null,
      stormwaterBenefit: `Up to $${round(building.annualStormwaterCreditDollars).toLocaleString()}/yr in stormwater credits on this roof.`,
      heatIslandBenefit: `Helps offset this roof's +${building.heatIslandIntensityF}°F urban heat-island effect.`,
      biodiversityBenefit:
        top.id.includes('green') || top.id === 'beekeeping'
          ? 'Supports pollinators and urban biodiversity.'
          : 'Limited direct biodiversity benefit for this option.',
      plainEnglishEquivalent: plainEnglish,
    },
    optionComparison,
    communityImpact: {
      individualImpact: `On its own, ${building.name} saves about $${annualNet.toLocaleString()}/yr${co2 ? ` and cuts ${co2} t of CO₂/yr` : ''} with ${top.name}.`,
      blockLevelImpact: `Across ${community.neighborCount + 1} buildings on this block, pooled stormwater credit reaches $${round(community.pooledStormwaterDollarsPerYear).toLocaleString()}/yr and heat drops ~${community.heatReductionF.toFixed(1)}°F.`,
      bulkDiscountSavings: communityDiscount || null,
      greenBlockGrantEligibility: community.cityGrantEligible
        ? 'Eligible now'
        : `Needs ${Math.max(0, ATLANTA.greenBlockMinBuildings - (community.neighborCount + 1))} more building(s)`,
      greenBlockGrantValue: community.cityGrantEligible ? round(community.cityGrantDollars) : null,
      pooledStormwaterCredit: round(community.pooledStormwaterDollarsPerYear),
      neighborhoodCo2Reduction: co2 != null ? round(co2 * (community.neighborCount + 1)) : null,
      recommendation: includeCommunity
        ? 'Invite neighboring rooftops to unlock bulk pricing and the Green Block grant.'
        : 'Community benefits were excluded from this analysis — enable them to see block-level upside.',
    },
    incentives: {
      availableIncentives,
      estimatedTotalIncentiveValue: incentiveTotal || null,
      notes: 'Per-option rebate amounts vary by provider and program; confirm current eligibility before installing.',
    },
    risksAndTradeoffs: risks.slice(0, 5),
    nextSteps: [
      { step: 'Schedule a roof inspection', description: `Confirm structural capacity and condition for ${top.name}.` },
      { step: 'Confirm rebate eligibility', description: 'Verify Federal ITC, Georgia Power, and City of Atlanta program eligibility.' },
      { step: 'Request installer quotes', description: 'Get 2–3 quotes to firm up the net cost estimate.' },
      ...(includeCommunity
        ? [{ step: 'Invite nearby buildings', description: 'Recruit neighbors to qualify for Green Block grant and bulk pricing.' }]
        : []),
      { step: 'Share the GreenTop report', description: 'Send this analysis to stakeholders or decision-makers.' },
    ],
    advisorSummary:
      `For ${building.name}, ${top.name} is the strongest rooftop move. ` +
      `Financially, expect about $${grossCost.toLocaleString()} upfront` +
      `${netCost !== grossCost ? ` (~$${netCost.toLocaleString()} after incentives)` : ''}` +
      `${pay != null ? `, breaking even in roughly ${pay} years` : ''}, with ~$${annualNet.toLocaleString()}/yr in savings. ` +
      `${co2 ? `Environmentally it avoids ${co2} t of CO₂ a year — ${plainEnglish.toLowerCase()} ` : ''}` +
      `${community.cityGrantEligible && includeCommunity ? `This block already qualifies for the $${round(community.cityGrantDollars).toLocaleString()} Green Block grant. ` : ''}` +
      `Before committing, get a professional inspection to confirm structural fit and final pricing.`,
    assumptions: [
      `Atlanta electricity rate $${ATLANTA.electricityRateDollarsPerKwh}/kWh.`,
      `Federal ITC ${Math.round(ATLANTA.federalITC * 100)}% applied where eligible.`,
      solar ? 'Roof area and solar production from live Google Solar data.' : 'Roof area and solar from modeled estimates (no live data).',
      'Building electricity use estimated from EIA CBECS 2018 (Table C15) intensity by building type, unless an actual bill was entered.',
      'Per-option costs use Atlanta market averages, not a site-specific quote.',
    ],
    source: 'fallback',
  }
}
