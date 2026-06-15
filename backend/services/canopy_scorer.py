"""
Canopy scoring engine — replaces the old optimizer.py.

This is a Python port of the frontend scoring logic in
cox-hackathon-app/lib/scoring.ts. Same algorithm, same weights, so the
backend and client-side scoring stay in sync.
"""

from models.schemas import Building, UserPreferences, RoofOption, ScoredOption, CommunityBonus


# ─────────────────────────────────────────
# Atlanta climate / financial constants
# (mirror of cox-hackathon-app/lib/constants.ts → ATLANTA)
# ─────────────────────────────────────────

ATLANTA = {
    "avg_solar_irradiance_kwh_m2_day": 5.1,
    "avg_annual_rainfall_inches": 50.2,
    "avg_wind_speed_mph": 9.0,
    "electricity_rate_dollars_per_kwh": 0.12,
    "stormwater_credit_rate_per_gallon": 0.18,
    "federal_itc": 0.30,
    "georgia_power_solar_rebate_per_sqft": 0.15,
    "city_green_block_grant_total": 25000,
    "green_block_min_buildings": 3,
}


# ─────────────────────────────────────────
# Roof option definitions
# (mirror of cox-hackathon-app/lib/options.ts → ROOF_OPTIONS)
# ─────────────────────────────────────────

ROOF_OPTIONS: list[RoofOption] = [
    RoofOption(
        id="cool-roof",
        name="Cool Roof Coating",
        shortDescription="Reflective coating. Fastest ROI, zero structural demand.",
        fullDescription="White elastomeric coating reduces surface temp by up to 38°F, cutting cooling loads. Qualifies for Georgia Power rebates. Correct answer for most pre-1980 buildings.",
        costPerSqFt=1.50, annualSavingsPerSqFt=0.45, co2TonsPerSqFtPerYear=0.0015,
        structuralLoadPSF=0, feasibilityBase=95,
        rebates=["Georgia Power: $0.15/sq ft", "Federal Energy Tax Credit"],
        warningFlags=[],
        bestFor="Any building. Essential for pre-1980 construction.",
    ),
    RoofOption(
        id="solar",
        name="Solar Panels",
        shortDescription="Grid-tied solar with Georgia Power net metering.",
        fullDescription="Monocrystalline panels with string inverters. Best on flat roofs with high sun exposure and post-1980 construction.",
        costPerSqFt=8.00, annualSavingsPerSqFt=1.20, co2TonsPerSqFtPerYear=0.008,
        structuralLoadPSF=4, feasibilityBase=80,
        rebates=["Federal ITC 30%", "Georgia Power net metering", "SREC market eligible"],
        warningFlags=["4 lbs/sq ft — verify structural capacity for pre-1980 buildings"],
        bestFor="Post-1980 flat roofs with high sun exposure.",
    ),
    RoofOption(
        id="green-roof-extensive",
        name="Green Roof (Extensive)",
        shortDescription="Lightweight sedum layer. Stormwater retention and insulation.",
        fullDescription="2–4 inch growing medium. Retains 60–80% of rainfall, reduces stormwater fees and urban heat. Low maintenance.",
        costPerSqFt=10.00, annualSavingsPerSqFt=0.80, co2TonsPerSqFtPerYear=0.006,
        structuralLoadPSF=12, feasibilityBase=70,
        rebates=["City of Atlanta Stormwater Credit", "Green Building Certification"],
        warningFlags=["12 lbs/sq ft — not for pre-1960 buildings without structural review"],
        bestFor="Post-1980 flat roofs. Community-facing buildings.",
    ),
    RoofOption(
        id="green-roof-intensive",
        name="Green Roof (Intensive)",
        shortDescription="Full rooftop garden. Revenue potential, high community impact.",
        fullDescription="Deep-soil garden with trees and seating. Revenue through events or leasing. Requires licensed structural engineer sign-off.",
        costPerSqFt=25.00, annualSavingsPerSqFt=1.50, co2TonsPerSqFtPerYear=0.012,
        structuralLoadPSF=100, feasibilityBase=40,
        rebates=["City of Atlanta Green Space Grant", "LEED certification value"],
        warningFlags=[
            "⚠ Requires licensed structural engineer sign-off",
            "⚠ 80–150 lbs/sq ft — most Atlanta buildings cannot support without modification",
        ],
        bestFor="Modern buildings (post-2000). Community or retail use.",
    ),
    RoofOption(
        id="rainwater",
        name="Rainwater Harvesting",
        shortDescription="Cistern system. Cuts stormwater fees immediately.",
        fullDescription="Cistern collects rainfall for irrigation and non-potable use. With Atlanta's 50 in/yr rainfall, immediate stormwater fee reduction. Pairs well with any roof treatment.",
        costFixed=12000, annualSavingsFixed=1800, co2TonsPerYear=0.5,
        structuralLoadPSF=2, feasibilityBase=88,
        rebates=["City of Atlanta Stormwater Retention Credit"],
        warningFlags=[],
        bestFor="Any flat roof. Best paired with green roof or cool roof.",
    ),
    RoofOption(
        id="beekeeping",
        name="Rooftop Beekeeping",
        shortDescription="Atlanta-legal hives. High revenue per sq ft, minimal load.",
        fullDescription="Atlanta permits rooftop beehives (City Code § 114-434). 2-hive setup: 100–200 lbs honey/yr plus pollination contracts. Fastest ROI of any option.",
        costFixed=4000, annualRevenueFixed=3500, co2TonsPerYear=0.2,
        structuralLoadPSF=1, feasibilityBase=92,
        rebates=[],
        warningFlags=["Requires City of Atlanta beekeeping permit", "Check lease restrictions"],
        bestFor="Any building. Strongest near restaurants or retail.",
    ),
]


# ─────────────────────────────────────────
# Scoring (port of scoreAndRankOptions)
# ─────────────────────────────────────────

def score_and_rank_options(b: Building, p: UserPreferences) -> list[ScoredOption]:
    scored: list[ScoredOption] = []
    for o in ROOF_OPTIONS:
        feasible = o.structural_load_psf <= b.max_load_psf
        cost = o.cost_fixed if o.cost_fixed is not None else (o.cost_per_sqft or 0) * b.roof_area_sqft
        net = (
            (o.annual_savings_fixed if o.annual_savings_fixed is not None
             else (o.annual_savings_per_sqft or 0) * b.roof_area_sqft)
            + (o.annual_revenue_fixed or 0)
        )
        roi = 999 if net <= 0 else round((cost / net) * 12)
        co2 = o.co2_tons_per_year if o.co2_tons_per_year is not None else (o.co2_tons_per_sqft_per_year or 0) * b.roof_area_sqft

        score = (
            max(0, 100 - (roi / 48) * 100) * (p.cost_sensitivity * 0.35)
            + min(100, co2 * 4) * ((1 - p.cost_sensitivity) * 0.30)
            + (o.feasibility_base if feasible else o.feasibility_base * 0.2) * 0.20
            + (100 if cost <= p.budget_dollars
               else max(0, 100 - ((cost - p.budget_dollars) / p.budget_dollars) * 100)) * 0.15
        )

        warnings_for_building = list(o.warning_flags)
        if not feasible:
            warnings_for_building.insert(
                0,
                f"⚠ Building max load ({b.max_load_psf:.0f} lbs/sq ft) is below "
                f"requirement ({o.structural_load_psf:.0f} lbs/sq ft)",
            )

        scored.append(ScoredOption(
            **o.model_dump(by_alias=True),
            score=score,
            feasible=feasible,
            uptrontCost=cost,
            annualNetDollars=net,
            roiMonths=roi,
            warningsForBuilding=warnings_for_building,
        ))

    scored.sort(key=lambda s: s.score, reverse=True)
    return scored


# ─────────────────────────────────────────
# Community bonus (port of calculateCommunityBonus)
# ─────────────────────────────────────────

def calculate_community_bonus(b: Building, neighbors: list[Building] | None = None) -> CommunityBonus:
    """
    `neighbors` are the resolved neighbor buildings. When not provided we fall
    back to using neighbor_ids count only (stormwater pooled estimate = self).
    """
    neighbors = neighbors or []
    neighbor_count = len(neighbors) if neighbors else len(b.neighbor_ids)
    count = neighbor_count + 1  # +1 for the selected building itself

    bulk = 0.12 if count >= 3 else (0.07 if count >= 2 else 0.0)
    pooled = b.annual_stormwater_credit_dollars + sum(
        n.annual_stormwater_credit_dollars for n in neighbors
    )
    eligible = count >= ATLANTA["green_block_min_buildings"]

    return CommunityBonus(
        neighborCount=neighbor_count,
        bulkDiscountPct=bulk,
        pooledStormwaterDollarsPerYear=pooled,
        heatReductionF=count * 1.6,
        cityGrantEligible=eligible,
        cityGrantDollars=ATLANTA["city_green_block_grant_total"] if eligible else 0,
    )
