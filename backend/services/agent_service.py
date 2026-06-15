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


def _get_client():
    global _client
    if _client is None and _GENAI_AVAILABLE and GEMINI_API_KEY:
        genai.configure(api_key=GEMINI_API_KEY)
        _client = genai.GenerativeModel("gemini-1.5-pro")
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
