"""
Canopy "Rooftop Advisor" agent service.

Keeps the original Gemini integration + SSE streaming structure, but all
narrative content is Canopy-specific rooftop analysis. The agent:
  1. Receives building data + preferences + scored options
  2. Streams human-readable phase messages via SSE (for the sidebar)
  3. Produces a final natural-language rooftop analysis
"""

import os
import json
import re
import asyncio
from typing import AsyncGenerator

try:
    import google.generativeai as genai
    _GENAI_AVAILABLE = True
except ImportError:
    genai = None  # type: ignore
    _GENAI_AVAILABLE = False

from models.schemas import Building, UserPreferences, ScoredOption, CommunityBonus

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")

_client = None


GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")


def _get_client():
    global _client
    if _client is None and _GENAI_AVAILABLE and GEMINI_API_KEY:
        genai.configure(api_key=GEMINI_API_KEY)
        _client = genai.GenerativeModel(GEMINI_MODEL)
    return _client


# ─────────────────────────────────────────
# Canopy prompt
# ─────────────────────────────────────────

CANOPY_PROMPT = """
You are Canopy, an AI rooftop advisor for urban buildings in Atlanta.

Building: {building_name} at {address}
Built: {year_built} | Roof: {roof_area_sqft:,} sq ft {roof_type} | Material: {roof_material}
Structural max load: {max_load_psf} lbs/sq ft
Sun exposure: {sun_exposure} hrs/day | Heat island: {heat_island_f}°F above baseline
Annual stormwater credit potential: ${stormwater_credit:,}/yr

User goals: {primary_goal} | Budget: ${budget:,} | Cost sensitivity: {cost_sensitivity}/10

Top-scored options from scoring engine:
{scored_options_summary}

Community: {neighbor_count} neighboring buildings identified on this block.

Write a concise rooftop analysis in 4 short phases:
1. Roof Assessment (2-3 sentences about this specific building's condition and constraints)
2. Environmental Analysis (solar, heat island, stormwater opportunity)
3. Financial Modeling (top recommendation with ROI rationale, what was ruled out and why)
4. Community Score (what changes if neighbors join, grant eligibility)

End with one clear sentence: the single best action this building owner should take today.
Be specific to this building. Use the actual numbers. Do not be generic.
"""


# ─────────────────────────────────────────
# Streaming agent phase messages (SSE)
# ─────────────────────────────────────────

ANALYSIS_PHASES = [
    {
        "phase": 1,
        "name": "Roof Assessment",
        "messages": [
            "Measuring roof footprint and surface geometry...",
            "Identifying roof type, material, and age class...",
            "Estimating structural load capacity for rooftop systems...",
            "Flagging pre-1980 load constraints where applicable...",
        ],
    },
    {
        "phase": 2,
        "name": "Environmental Data",
        "messages": [
            "Pulling Atlanta solar irradiance (5.1 kWh/m²/day)...",
            "Measuring urban heat-island intensity above baseline...",
            "Modeling stormwater retention against 50.2 in/yr rainfall...",
            "Checking wind viability (9 mph avg — below turbine threshold)...",
        ],
    },
    {
        "phase": 3,
        "name": "Financial Modeling",
        "messages": [
            "Costing each rooftop option at current Atlanta rates...",
            "Applying Federal ITC (30%) and Georgia Power rebates...",
            "Computing payback period and annual net return...",
            "Ranking options against your budget and goals...",
        ],
    },
    {
        "phase": 4,
        "name": "Community Score",
        "messages": [
            "Locating opted-in neighbors on your city block...",
            "Calculating bulk-install discount and pooled stormwater credits...",
            "Checking City of Atlanta Green Block grant eligibility ($25,000)...",
            "Finalizing your ranked rooftop recommendation...",
        ],
    },
]


async def stream_agent_phases() -> AsyncGenerator[str, None]:
    """
    Yields Server-Sent Events for each phase message so the frontend can
    animate the sidebar. Each event:
      data: {"phase": 1, "name": "Roof Assessment", "message": "...", "done": false}
    """
    for phase_info in ANALYSIS_PHASES:
        for msg in phase_info["messages"]:
            payload = {
                "phase": phase_info["phase"],
                "name": phase_info["name"],
                "message": msg,
                "done": False,
            }
            yield f"data: {json.dumps(payload)}\n\n"
            await asyncio.sleep(0.6)

    yield f"data: {json.dumps({'phase': 4, 'name': 'Complete', 'message': '', 'done': True})}\n\n"


# ─────────────────────────────────────────
# Final summary generation
# ─────────────────────────────────────────

async def generate_summary(
    building: Building,
    preferences: UserPreferences,
    ranked_options: list[ScoredOption],
    community: CommunityBonus,
) -> str:
    """
    Calls Gemini for a natural-language rooftop analysis. Falls back to a
    template summary when Gemini is unavailable so the demo never breaks.
    """
    client = _get_client()
    if client is None:
        return _template_summary(building, preferences, ranked_options, community)

    try:
        prompt = _build_prompt(building, preferences, ranked_options, community)
        response = await asyncio.to_thread(client.generate_content, prompt)
        return response.text.strip()
    except Exception as e:  # noqa: BLE001
        print(f"[Gemini] Summary generation failed: {e}")
        return _template_summary(building, preferences, ranked_options, community)


def _build_prompt(
    building: Building,
    preferences: UserPreferences,
    ranked_options: list[ScoredOption],
    community: CommunityBonus,
) -> str:
    summary_lines = "\n".join(
        f"- {o.name}: score {o.score:.0f}, upfront ${o.upfront_cost:,.0f}, "
        f"ROI {o.roi_months} mo, {'feasible' if o.feasible else 'NOT feasible (load)'}"
        for o in ranked_options[:4]
    )
    return CANOPY_PROMPT.format(
        building_name=building.name,
        address=building.address,
        year_built=building.year_built,
        roof_area_sqft=int(building.roof_area_sqft),
        roof_type=building.roof_type,
        roof_material=building.roof_material,
        max_load_psf=building.max_load_psf,
        sun_exposure=building.sun_exposure_hrs_per_day,
        heat_island_f=building.heat_island_intensity_f,
        stormwater_credit=int(building.annual_stormwater_credit_dollars),
        primary_goal=preferences.primary_goal,
        budget=int(preferences.budget_dollars),
        cost_sensitivity=round(preferences.cost_sensitivity * 10),
        scored_options_summary=summary_lines,
        neighbor_count=community.neighbor_count,
    )


def _template_summary(
    building: Building,
    preferences: UserPreferences,
    ranked_options: list[ScoredOption],
    community: CommunityBonus,
) -> str:
    b = building
    top = ranked_options[0] if ranked_options else None
    age_note = (
        "Built before 1980, its structural load capacity is limited, ruling out heavier systems."
        if b.year_built < 1980 else
        "Post-1980 construction gives it standard load capacity for most rooftop systems."
    )
    grant_note = (
        f" If neighbors join, the block qualifies for the City of Atlanta Green Block grant "
        f"(${community.city_grant_dollars:,.0f}) plus a {community.bulk_discount_pct*100:.0f}% bulk discount."
        if community.city_grant_eligible else
        f" With more neighbors opted in, the block could unlock the $25,000 City of Atlanta Green Block grant."
    )

    top_line = (
        f"The strongest fit is {top.name} — roughly ${top.upfront_cost:,.0f} upfront "
        f"with a payback of about {top.roi_months} months."
        if top else "No options scored above the feasibility threshold."
    )

    return (
        f"Roof Assessment: {b.name} offers {b.roof_area_sqft:,.0f} sq ft of {b.roof_type.lower()} "
        f"{b.roof_material.lower()} roof. {age_note}\n\n"
        f"Environmental Analysis: At {b.sun_exposure_hrs_per_day} sun hours/day and a heat-island "
        f"intensity of {b.heat_island_intensity_f}°F above baseline, this roof drives avoidable cooling "
        f"costs and stormwater runoff worth ${b.annual_stormwater_credit_dollars:,.0f}/yr in credits.\n\n"
        f"Financial Modeling: {top_line}\n\n"
        f"Community Score: {community.neighbor_count} neighboring buildings sit on this block.{grant_note}\n\n"
        f"Recommended next step: {('Start with ' + top.name + ' and invite your block to opt in together.') if top else 'Review feasible options with a structural engineer.'}"
    )


# ═════════════════════════════════════════════════════════════════════════
# Structured dashboard generation (Gemini → strict JSON, with fallback)
# ═════════════════════════════════════════════════════════════════════════

M2_TO_SQFT = 10.7639
CARS_CO2_TONS_PER_YEAR = 4.6  # EPA: avg passenger vehicle, metric tons CO₂/yr

_OPTION_META = {
    "cool-roof": {"category": "Reflective Coating", "maintenance": "Low"},
    "solar": {"category": "Solar", "maintenance": "Low"},
    "green-roof-extensive": {"category": "Green Infrastructure", "maintenance": "Medium"},
    "green-roof-intensive": {"category": "Green Infrastructure", "maintenance": "High"},
    "rainwater": {"category": "Water Systems", "maintenance": "Low"},
    "beekeeping": {"category": "Urban Agriculture", "maintenance": "Medium"},
}


def _meta(option_id: str) -> dict:
    return _OPTION_META.get(option_id, {"category": "Rooftop", "maintenance": "Medium"})


def _feasibility_label(o: ScoredOption) -> str:
    if not o.feasible:
        return "Needs Inspection"
    if o.feasibility_base >= 85:
        return "Strong Fit"
    if o.feasibility_base >= 60:
        return "Moderate Fit"
    return "Needs Inspection"


def _co2_for(o: ScoredOption, roof_area_sqft: float) -> float:
    if o.co2_tons_per_year is not None:
        return round(o.co2_tons_per_year, 1)
    return round((o.co2_tons_per_sqft_per_year or 0) * roof_area_sqft, 1)


def _payback_years(roi_months: int):
    return round(roi_months / 12, 1) if roi_months < 900 else None


def build_dashboard_input(building, preferences, ranked, community, solar_insights) -> dict:
    """Assemble the structured INPUT_JSON Gemini (and the fallback) consume.

    Only analysis facts go in here — never API keys. The Google Solar key was
    already used server-side to produce `solar_insights`; we pass the summary,
    not the credential.
    """
    from services.canopy_scorer import ATLANTA  # local import avoids cycle

    include_community = getattr(preferences, "include_community", True)
    bulk = community.bulk_discount_pct
    roof_area = building.roof_area_sqft

    scored: list[dict] = []
    for i, o in enumerate(ranked):
        net = round(o.upfront_cost * (1 - bulk)) if include_community else round(o.upfront_cost)
        annual = round(o.annual_net_dollars)
        scored.append({
            "rank": i + 1,
            "name": o.name,
            "score": round(o.score),
            "upfrontCost": round(o.upfront_cost),
            "netCostAfterIncentives": net,
            "annualSavings": annual,
            "paybackYears": _payback_years(o.roi_months),
            "roiPercent": round(annual / net * 100) if net > 0 and annual > 0 else None,
            "co2ReductionPerYear": _co2_for(o, roof_area),
            "feasibility": _feasibility_label(o),
            "maintenanceLevel": _meta(o.id)["maintenance"],
            "rebates": list(o.rebates),
            "assumptions": [],
        })

    si = solar_insights or {}
    roof_area_m2 = si.get("roof_area_m2")
    roof_sqft = round(roof_area_m2 * M2_TO_SQFT) if roof_area_m2 else round(roof_area)

    # Whole-building electricity use: the owner's real bill when given, else a
    # modeled estimate (floor area × EIA CBECS 2018 Table C15 intensity).
    rate = ATLANTA["electricity_rate_dollars_per_kwh"]
    bill = getattr(preferences, "monthly_electric_bill", None)
    if bill and bill > 0:
        building_kwh = round(bill * 12 / rate)
        energy_source = "actual (owner bill)"
    else:
        _eui = {"office": 17, "retail": 14, "warehouse": 5, "residential": 9}.get(building.building_type, 14)
        _floors = {"office": 3, "retail": 2, "warehouse": 2, "residential": 3}.get(building.building_type, 3)
        building_kwh = round(roof_sqft * _floors * _eui)
        energy_source = "estimated (EIA CBECS 2018)"
    solar_kwh = si.get("max_annual_kwh") or 0
    offset_pct = (
        min(100, round(solar_kwh / building_kwh * 100)) if (building_kwh and solar_kwh) else None
    )

    solar_block = {
        "roofArea": roof_sqft,
        "usableRoofArea": round(roof_area_m2 * M2_TO_SQFT) if roof_area_m2 else None,
        "solarPotential": (
            f"{round(si['max_annual_kwh']):,} kWh/yr" if si.get("max_annual_kwh") else "Estimated from roof area"
        ),
        "sunlightHours": si.get("sun_exposure_hrs_per_day") or building.sun_exposure_hrs_per_day,
        "maxPanels": si.get("max_array_panels_count"),
        "estimatedAnnualSolarProduction": si.get("max_annual_kwh"),
        "recommendedRoofCoveragePct": si.get("roof_coverage_pct"),
        "buildingEnergyUseKwh": building_kwh,
        "buildingEnergyUseSource": energy_source,
        "solarOffsetPctOfBuildingUse": offset_pct,
        "roofSegments": [],
        "dataConfidence": "High — live Google Solar data" if solar_insights else "Moderate — modeled estimate",
        "limitations": [] if solar_insights else ["No live Google Solar coverage for this location"],
    }

    top = ranked[0] if ranked else None
    community_block = {
        "enabled": include_community,
        "bulkDiscountSavings": round(bulk * top.upfront_cost) if (include_community and top) else 0,
        "greenBlockGrantEligibility": "Eligible now" if community.city_grant_eligible else "Not yet eligible",
        "greenBlockGrantValue": round(community.city_grant_dollars) if community.city_grant_eligible else 0,
        "pooledStormwaterCredit": round(community.pooled_stormwater_dollars_per_year),
        "neighborhoodCo2Reduction": (
            round(_co2_for(top, roof_area) * (community.neighbor_count + 1)) if top else 0
        ),
        "nearbyRoofsEstimated": community.neighbor_count,
    }

    return {
        "location": {
            "address": building.address,
            "latitude": building.lat,
            "longitude": building.lng,
            "buildingName": building.name,
        },
        "userPreferences": {
            "budget": preferences.budget_dollars,
            "impactVsPaybackWeight": preferences.cost_sensitivity,
            "primaryGoal": preferences.primary_goal,
            "includeCommunityBenefits": include_community,
        },
        "solarInsights": solar_block,
        "scoredOptions": scored,
        "communityBonus": community_block,
        "constants": {
            "city": "Atlanta",
            "electricityRate": ATLANTA["electricity_rate_dollars_per_kwh"],
            "co2Factor": (solar_insights or {}).get("carbon_offset_factor_kg_per_mwh", 400),
            "stormwaterCreditRate": ATLANTA["stormwater_credit_rate_per_gallon"],
            "federalITC": ATLANTA["federal_itc"],
        },
        "assumptions": [
            f"Atlanta electricity rate ${ATLANTA['electricity_rate_dollars_per_kwh']}/kWh.",
            f"Federal ITC {round(ATLANTA['federal_itc'] * 100)}% applied where eligible.",
            "Per-option costs use Atlanta market averages, not a site-specific quote.",
            f"Building electricity use is {energy_source}; estimates use EIA CBECS 2018 (Table C15) intensity by building type.",
        ],
        "missingData": [] if solar_insights else ["Live Google Solar rooftop data"],
    }


def _parse_json_lenient(text: str):
    """Parse Gemini output, repairing a fenced/wrapped JSON blob once."""
    if not text:
        return None
    t = text.strip()
    if t.startswith("```"):
        t = re.sub(r"^```[a-zA-Z]*\n?", "", t)
        t = re.sub(r"\n?```$", "", t).strip()
    try:
        return json.loads(t)
    except Exception:  # noqa: BLE001
        pass
    start, end = t.find("{"), t.rfind("}")
    if start != -1 and end > start:
        try:
            return json.loads(t[start : end + 1])
        except Exception:  # noqa: BLE001
            return None
    return None


def _fallback_dashboard(input_data: dict) -> dict:
    """Deterministic dashboard built from the same INPUT_JSON Gemini receives,
    so the answer page renders even when Gemini is unavailable."""
    opts = input_data.get("scoredOptions", [])
    loc = input_data.get("location", {})
    prefs = input_data.get("userPreferences", {})
    comm = input_data.get("communityBonus", {})
    solar = input_data.get("solarInsights", {})

    if not opts:
        top = {"name": "No feasible option", "co2ReductionPerYear": None}
    else:
        top = opts[0]

    gross = top.get("upfrontCost")
    net = top.get("netCostAfterIncentives")
    annual = top.get("annualSavings")
    pay = top.get("paybackYears")
    co2 = top.get("co2ReductionPerYear")
    grant = comm.get("greenBlockGrantValue") or 0
    bulk_savings = comm.get("bulkDiscountSavings") or 0
    include_comm = comm.get("enabled", True)

    def m(v):
        return f"${round(v):,}" if isinstance(v, (int, float)) else "—"

    timeline = "Long-term" if pay is None else "Short-term" if pay <= 3 else "Medium-term" if pay <= 8 else "Long-term"
    plain = (
        f"Equivalent to taking about {round(co2 / CARS_CO2_TONS_PER_YEAR)} cars off the road each year."
        if isinstance(co2, (int, float)) and co2 > 0
        else "Environmental impact is modest for this option on this roof."
    )

    incentives = []
    if bulk_savings:
        incentives.append({"name": "Green Block bulk discount", "estimatedValue": bulk_savings,
                           "description": "Shared installation pricing when neighboring roofs join."})
    if grant:
        incentives.append({"name": "City of Atlanta Green Block grant", "estimatedValue": grant,
                           "description": "One-time grant for an eligible block-wide green plan."})
    for r in top.get("rebates", []):
        incentives.append({"name": r, "estimatedValue": None, "description": ""})

    risks = []
    if top.get("feasibility") == "Needs Inspection":
        risks.append({"title": "Structural / feasibility review", "severity": "High",
                      "explanation": "This option needs a structural review before installation."})
    if isinstance(pay, (int, float)) and pay > 10:
        risks.append({"title": "Long payback period", "severity": "Medium",
                      "explanation": f"Estimated payback is ~{pay} years; value accrues long-term."})
    if not input_data.get("solarInsights", {}).get("estimatedAnnualSolarProduction"):
        risks.append({"title": "Estimated rooftop data", "severity": "Low",
                      "explanation": "Live satellite roof data was unavailable; figures are modeled."})
    risks.append({"title": "Professional inspection recommended", "severity": "Low",
                  "explanation": "A licensed inspection confirms structural fit and final pricing."})

    meta_cat = _OPTION_META.get(
        next((o for o in _OPTION_META if _OPTION_META[o]["category"] and top.get("name", "").lower().find("solar") >= 0 and o == "solar"), ""),
        {},
    )

    next_steps = [
        {"step": "Schedule a roof inspection", "description": f"Confirm structural capacity for {top.get('name')}."},
        {"step": "Confirm rebate eligibility", "description": "Verify Federal ITC, Georgia Power, and City programs."},
        {"step": "Request installer quotes", "description": "Get 2–3 quotes to firm up the net cost estimate."},
    ]
    if include_comm:
        next_steps.append({"step": "Invite nearby buildings", "description": "Recruit neighbors for Green Block eligibility."})
    next_steps.append({"step": "Share the Canopy report", "description": "Send this analysis to stakeholders."})

    return {
        "recommendedOption": {
            "name": top.get("name", ""),
            "category": meta_cat.get("category", "Rooftop") if meta_cat else "Rooftop",
            "shortHeadline": top.get("summary", ""),
            "whyThisWins": f"{top.get('name')} ranks highest for this roof, balancing cost, feasibility, and your stated goal of {prefs.get('primaryGoal', 'savings')}.",
            "confidenceLabel": "High confidence" if top.get("score", 0) >= 70 else "Moderate confidence",
            "feasibilityLabel": top.get("feasibility", ""),
            "primaryReason": (f"Payback in ~{pay} yr" if pay else "Best overall balance of cost and impact"),
        },
        "keyMetrics": {
            "upfrontCost": gross,
            "netCostAfterIncentives": net,
            "annualSavings": annual,
            "paybackYears": pay,
            "roiPercent": top.get("roiPercent"),
            "co2ReductionPerYear": co2,
            "tenYearValue": round(annual * 10 - net) if isinstance(annual, (int, float)) and isinstance(net, (int, float)) else None,
            "twentyYearValue": round(annual * 20 - net) if isinstance(annual, (int, float)) and isinstance(net, (int, float)) else None,
        },
        "roofSummary": {
            "address": loc.get("address", ""),
            "roofArea": solar.get("roofArea"),
            "usableRoofArea": solar.get("usableRoofArea"),
            "solarPotential": solar.get("solarPotential", ""),
            "sunlightSummary": f"{solar.get('sunlightHours', '—')} sun hours/day",
            "structuralNotes": "Confirm structural load capacity before installing heavier systems.",
            "dataConfidence": solar.get("dataConfidence", ""),
        },
        "financialBreakdown": {
            "grossCost": gross,
            "rebates": None,
            "communityDiscount": bulk_savings or None,
            "grantValue": grant or None,
            "estimatedMaintenanceCost": None,
            "netCost": net,
            "annualSavingsOrRevenue": annual,
            "breakEvenExplanation": (
                f"At {m(annual)}/yr in savings, the {m(net)} net cost breaks even in roughly {pay} years."
                if pay else "This option delivers long-term value rather than a fast cash payback."
            ),
            "investmentTimeline": timeline,
        },
        "environmentalImpact": {
            "co2ReductionPerYear": co2,
            "lifetimeCo2Reduction": round(co2 * 20, 1) if isinstance(co2, (int, float)) else None,
            "stormwaterBenefit": f"Pooled stormwater credit up to {m(comm.get('pooledStormwaterCredit'))}/yr across the block.",
            "heatIslandBenefit": "Helps reduce this roof's contribution to the urban heat island.",
            "biodiversityBenefit": (
                "Supports pollinators and urban biodiversity."
                if "green" in top.get("name", "").lower() or "bee" in top.get("name", "").lower()
                else "Limited direct biodiversity benefit for this option."
            ),
            "plainEnglishEquivalent": plain,
        },
        "optionComparison": [
            {
                "rank": o.get("rank"),
                "name": o.get("name"),
                "upfrontCost": o.get("upfrontCost"),
                "netCostAfterIncentives": o.get("netCostAfterIncentives"),
                "annualSavings": o.get("annualSavings"),
                "paybackYears": o.get("paybackYears"),
                "roiPercent": o.get("roiPercent"),
                "co2ReductionPerYear": o.get("co2ReductionPerYear"),
                "feasibility": o.get("feasibility"),
                "maintenanceLevel": o.get("maintenanceLevel"),
                "score": o.get("score"),
                "summary": o.get("summary", ""),
            }
            for o in opts
        ],
        "communityImpact": {
            "individualImpact": f"On its own, this roof saves about {m(annual)}/yr with {top.get('name')}.",
            "blockLevelImpact": f"Across {comm.get('nearbyRoofsEstimated', 0) + 1} buildings, pooled stormwater credit reaches {m(comm.get('pooledStormwaterCredit'))}/yr.",
            "bulkDiscountSavings": bulk_savings or None,
            "greenBlockGrantEligibility": comm.get("greenBlockGrantEligibility", ""),
            "greenBlockGrantValue": grant or None,
            "pooledStormwaterCredit": comm.get("pooledStormwaterCredit"),
            "neighborhoodCo2Reduction": comm.get("neighborhoodCo2Reduction"),
            "recommendation": (
                "Invite neighboring rooftops to unlock bulk pricing and the Green Block grant."
                if include_comm else "Enable community benefits to see block-level upside."
            ),
        },
        "incentives": {
            "availableIncentives": incentives,
            "estimatedTotalIncentiveValue": (bulk_savings + grant) or None,
            "notes": "Per-option rebate amounts vary by provider; confirm eligibility before installing.",
        },
        "risksAndTradeoffs": risks[:5],
        "nextSteps": next_steps,
        "advisorSummary": (
            f"{top.get('name')} is the strongest rooftop move for {loc.get('buildingName', 'this building')}. "
            f"Expect about {m(gross)} upfront ({m(net)} after incentives)"
            f"{f', breaking even in ~{pay} years' if pay else ''}, with ~{m(annual)}/yr in savings. "
            f"{f'It avoids {co2} t of CO₂ a year. ' if isinstance(co2, (int, float)) and co2 else ''}"
            "Get a professional inspection to confirm structural fit and final pricing before committing."
        ),
        "assumptions": input_data.get("assumptions", []),
    }


async def generate_dashboard_analysis(input_data: dict) -> dict:
    """Send the structured analysis context to Gemini and return strict
    dashboard JSON. Falls back to a deterministic dashboard on any failure so
    the API always returns a renderable dashboard."""
    client = _get_client()
    if client is None:
        fb = _fallback_dashboard(input_data)
        fb["source"] = "fallback"
        return fb

    try:
        prompt = GEMINI_DASHBOARD_PROMPT.replace("{{INPUT_JSON}}", json.dumps(input_data, default=str))
        response = await asyncio.to_thread(
            client.generate_content,
            prompt,
            generation_config={"response_mime_type": "application/json", "temperature": 0.4},
        )
        parsed = _parse_json_lenient(getattr(response, "text", "") or "")
        if parsed is None or "recommendedOption" not in parsed:
            raise ValueError("Gemini returned unusable JSON")
        parsed["source"] = "gemini"
        return parsed
    except Exception as e:  # noqa: BLE001
        print(f"[Gemini] Dashboard generation failed: {e}")
        fb = _fallback_dashboard(input_data)
        fb["source"] = "fallback"
        return fb


GEMINI_DASHBOARD_PROMPT = """
You are Canopy, an AI rooftop sustainability and ROI advisor for Atlanta buildings.

Your job is to analyze a selected rooftop using the provided building location, Google Solar API data, user preferences, deterministic rooftop scoring results, financial assumptions, environmental assumptions, incentives, and community/block-level bonus data.

You are producing the final dashboard content for a building owner deciding what to do with their rooftop.

The user wants to know:
What is the best rooftop intervention for this building?
Why is it the best choice?
How much will it cost?
How much money will it save or generate?
What is the payback period and ROI?
How much CO2 will it reduce?
Is the roof physically and financially feasible?
What changes if nearby rooftops join a community/block program?
What risks should the owner understand?
What should the owner do next?

You will receive structured input containing:
selected building address and location
building/roof details
Google Solar API summary
user preferences
scored rooftop intervention options
community bonus calculations
rebates and incentives
Atlanta-specific constants
assumptions and missing data

Important rules:
Return ONLY valid JSON.
Do not return markdown.
Do not include code fences.
Do not include commentary outside the JSON.
Do not invent precise numbers if they are not provided.
Use the scored option data as the source of truth for costs, savings, payback, ROI, CO2, and rankings.
If a value is missing, use null and explain the missing data in the relevant notes or assumptions field.
Do not exaggerate certainty.
Be persuasive but honest.
Mention when a professional roof inspection or structural review is needed.
The final recommendation should reflect both the quantitative score and the user's stated preferences.
The tone should be clear, confident, civic-tech, sustainability-focused, and useful for a building owner.
The dashboard should convince the user through numbers, tradeoffs, and clear reasoning.

Return JSON using this exact structure:
{
"recommendedOption": {
"name": "",
"category": "",
"shortHeadline": "",
"whyThisWins": "",
"confidenceLabel": "",
"feasibilityLabel": "",
"primaryReason": ""
},
"keyMetrics": {
"upfrontCost": null,
"netCostAfterIncentives": null,
"annualSavings": null,
"paybackYears": null,
"roiPercent": null,
"co2ReductionPerYear": null,
"tenYearValue": null,
"twentyYearValue": null
},
"roofSummary": {
"address": "",
"roofArea": null,
"usableRoofArea": null,
"solarPotential": "",
"sunlightSummary": "",
"structuralNotes": "",
"dataConfidence": ""
},
"financialBreakdown": {
"grossCost": null,
"rebates": null,
"communityDiscount": null,
"grantValue": null,
"estimatedMaintenanceCost": null,
"netCost": null,
"annualSavingsOrRevenue": null,
"breakEvenExplanation": "",
"investmentTimeline": ""
},
"environmentalImpact": {
"co2ReductionPerYear": null,
"lifetimeCo2Reduction": null,
"stormwaterBenefit": "",
"heatIslandBenefit": "",
"biodiversityBenefit": "",
"plainEnglishEquivalent": ""
},
"optionComparison": [
{
"rank": null,
"name": "",
"upfrontCost": null,
"netCostAfterIncentives": null,
"annualSavings": null,
"paybackYears": null,
"roiPercent": null,
"co2ReductionPerYear": null,
"feasibility": "",
"maintenanceLevel": "",
"score": null,
"summary": ""
}
],
"communityImpact": {
"individualImpact": "",
"blockLevelImpact": "",
"bulkDiscountSavings": null,
"greenBlockGrantEligibility": "",
"greenBlockGrantValue": null,
"pooledStormwaterCredit": null,
"neighborhoodCo2Reduction": null,
"recommendation": ""
},
"incentives": {
"availableIncentives": [
{
"name": "",
"estimatedValue": null,
"description": ""
}
],
"estimatedTotalIncentiveValue": null,
"notes": ""
},
"risksAndTradeoffs": [
{
"title": "",
"severity": "",
"explanation": ""
}
],
"nextSteps": [
{
"step": "",
"description": ""
}
],
"advisorSummary": "",
"assumptions": [
""
]
}

Now analyze the following structured input and return the final dashboard JSON.
INPUT:
{{INPUT_JSON}}
"""
