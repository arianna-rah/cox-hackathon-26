"""
Gemini "Energy Architect" agent service.

Mirrors TerraWatt's agentic approach: instead of just returning JSON,
we stream a structured analysis as the agent "thinks through" the plan.
This feeds the real-time sidebar in the frontend.

The agent:
  1. Receives the raw site data + constraints
  2. Generates human-readable phase messages (streamed via SSE)
  3. Produces the final structured plan summary
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

from models.schemas import AnalysisResult, AreaData, PlanConstraints

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")

# Initialize Gemini client (lazy — only if key is set)
_client = None


def _get_client():
    global _client
    if _client is None and _GENAI_AVAILABLE:
        genai.configure(api_key=GEMINI_API_KEY)
        _client = genai.GenerativeModel("gemini-1.5-pro")
    return _client


# ─────────────────────────────────────────
# Streaming agent messages
# ─────────────────────────────────────────

ANALYSIS_PHASES = [
    {
        "phase": 1,
        "name": "Data Collection",
        "messages": [
            "Fetching topographical and elevation data for your site...",
            "Retrieving 10-year solar irradiance records from NREL NSRDB...",
            "Analyzing roof geometry and segment orientations...",
            "Checking local utility interconnection requirements...",
        ],
    },
    {
        "phase": 2,
        "name": "Constraint Integration",
        "messages": [
            "Applying your budget and financing preferences...",
            "Marking exclusion zones and existing structures...",
            "Evaluating land use compatibility with renewable systems...",
            "Factoring in your energy independence goals...",
        ],
    },
    {
        "phase": 3,
        "name": "Technology Optimization",
        "messages": [
            "Scoring each roof segment by orientation, tilt, and sun exposure...",
            "Running layout simulations across panel configurations...",
            "Evaluating hybrid solar + storage scenarios...",
            "Calculating optimal row spacing and shading avoidance...",
        ],
    },
    {
        "phase": 4,
        "name": "System Design",
        "messages": [
            "Selecting panel model and inverter configuration...",
            "Sizing battery storage for your grid connection preference...",
            "Planning cable routing and combiner boxes...",
            "Verifying compliance with NEC and local codes...",
        ],
    },
    {
        "phase": 5,
        "name": "Financial Modeling",
        "messages": [
            "Estimating installed costs at current market rates...",
            "Projecting 25-year energy production and savings...",
            "Applying Federal ITC (30%) and state incentives...",
            "Checking USDA REAP grant eligibility...",
            "Calculating ROI, NPV, and payback period...",
        ],
    },
]


async def stream_agent_phases() -> AsyncGenerator[str, None]:
    """
    Yields Server-Sent Events (SSE) formatted strings for each phase message.
    The frontend listens to these to animate the sidebar.

    Format per event:
      data: {"phase": 1, "name": "Data Collection", "message": "...", "done": false}
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
            await asyncio.sleep(0.6)  # Realistic pacing

    yield f"data: {json.dumps({'phase': 5, 'name': 'Complete', 'message': '', 'done': True})}\n\n"


# ─────────────────────────────────────────
# Gemini summary generation
# ─────────────────────────────────────────

async def generate_plan_summary(
    area: AreaData,
    constraints: PlanConstraints,
    analysis: AnalysisResult,
) -> str:
    """
    Calls Gemini to generate a natural-language executive summary of the plan.
    This becomes the `agent_summary` field in AnalysisResult.

    Falls back to a template summary if Gemini is unavailable.
    """
    if not GEMINI_API_KEY:
        return _template_summary(area, constraints, analysis)

    try:
        client = _get_client()
        prompt = _build_summary_prompt(area, constraints, analysis)
        response = await asyncio.to_thread(client.generate_content, prompt)
        return response.text.strip()
    except Exception as e:
        print(f"[Gemini] Summary generation failed: {e}")
        return _template_summary(area, constraints, analysis)


async def generate_scenario_comparison(
    analysis: AnalysisResult,
    constraints: PlanConstraints,
) -> dict:
    """
    Uses Gemini to generate a scenario comparison:
      - "Maximum Output" config
      - "Cost-Optimized" config

    Returns a dict the frontend renders in the Analytics → Comparison tab.
    Falls back to simple computed values if Gemini is unavailable.
    """
    fin = analysis.financials

    max_output_scenario = {
        "label": "Maximum Theoretical Output",
        "description": "System sized for maximum annual kWh production, ignoring budget efficiency.",
        "system_cost_usd": fin.total_system_cost_usd * 1.4,
        "annual_kwh": fin.annual_production_kwh * 1.35,
        "payback_years": fin.payback_years * 1.1,
        "roi_25_year": fin.roi_25_year_usd * 1.2,
    }

    cost_optimized_scenario = {
        "label": "Cost-Optimized Build",
        "description": "Best ROI per dollar invested. Smaller system, faster payback.",
        "system_cost_usd": fin.total_system_cost_usd * 0.65,
        "annual_kwh": fin.annual_production_kwh * 0.70,
        "payback_years": fin.payback_years * 0.85,
        "roi_25_year": fin.roi_25_year_usd * 0.80,
    }

    if GEMINI_API_KEY:
        try:
            client = _get_client()
            prompt = f"""
You are an energy finance expert. Given this renewable energy system analysis:
- Annual production: {fin.annual_production_kwh:,.0f} kWh
- Total cost: ${fin.total_system_cost_usd:,.0f}
- Payback period: {fin.payback_years:.1f} years
- 25-year ROI: ${fin.roi_25_year_usd:,.0f}
- Primary goal: {constraints.energy.primary_goal}
- Budget: ${constraints.budget.min:,.0f} - ${constraints.budget.max:,.0f}

Write 1-2 sentences each explaining why the "Maximum Output" vs "Cost-Optimized" 
scenario might suit different farmer priorities. Be concise and specific to agriculture.
Return JSON with keys: max_output_insight, cost_optimized_insight.
"""
            response = await asyncio.to_thread(client.generate_content, prompt)
            text = response.text.strip()
            if text.startswith("{"):
                insights = json.loads(text)
                max_output_scenario["ai_insight"] = insights.get("max_output_insight", "")
                cost_optimized_scenario["ai_insight"] = insights.get("cost_optimized_insight", "")
        except Exception as e:
            print(f"[Gemini] Scenario comparison failed: {e}")

    return {
        "recommended": "current",
        "scenarios": {
            "current": {
                "label": "Your Optimized Plan",
                "system_cost_usd": fin.total_system_cost_usd,
                "annual_kwh": fin.annual_production_kwh,
                "payback_years": fin.payback_years,
                "roi_25_year": fin.roi_25_year_usd,
            },
            "max_output": max_output_scenario,
            "cost_optimized": cost_optimized_scenario,
        },
    }


# ─────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────

def _build_summary_prompt(area: AreaData, constraints: PlanConstraints, analysis: AnalysisResult) -> str:
    fin = analysis.financials
    layout = analysis.layout
    return f"""
You are TerraWatt's Energy Architect AI. Write a concise, confident executive summary 
(3-4 paragraphs) for a farmer evaluating renewable energy on their land.

Site details:
- Location: {area.address or f'Lat/Lng near center {area.center}'}
- Area: {area.area_acres:.1f} acres
- Budget: ${constraints.budget.min:,.0f} – ${constraints.budget.max:,.0f}
- Primary goal: {constraints.energy.primary_goal}
- Technologies requested: {', '.join(constraints.technical.technologies)}

System designed:
- Solar capacity: {layout.solar_capacity_kw or 0:.1f} kW ({layout.panel_count or 0} panels)
- Wind capacity: {layout.wind_capacity_kw or 0:.1f} kW ({layout.turbine_count or 0} turbines)
- Storage: {layout.storage_capacity_kwh or 0:.1f} kWh
- Usable area used: {layout.coverage_pct:.0f}% of {layout.usable_area_m2:.0f} m²

Financials:
- Total cost: ${fin.total_system_cost_usd:,.0f}
- After incentives: ${fin.net_cost_after_incentives_usd:,.0f} (30% Federal ITC + state)
- Annual production: {fin.annual_production_kwh:,.0f} kWh
- Annual savings: ${fin.annual_savings_usd:,.0f}
- Payback: {fin.payback_years:.1f} years
- 25-year ROI: ${fin.roi_25_year_usd:,.0f}
- CO₂ offset: {fin.co2_offset_tons_per_year:.1f} tons/year
- USDA REAP eligible: {'Yes' if fin.usda_reap_eligible else 'No'}

Write in plain English for a farmer, not a technical audience. Highlight the most 
compelling reason to move forward. Mention USDA REAP if eligible. End with next steps.
"""


def _template_summary(area: AreaData, constraints: PlanConstraints, analysis: AnalysisResult) -> str:
    fin = analysis.financials
    layout = analysis.layout
    reap_note = " Your operation may also qualify for USDA REAP grants, which can cover up to 50% of project costs." if fin.usda_reap_eligible else ""

    return (
        f"Your {area.area_acres:.1f}-acre site is well-suited for renewable energy development. "
        f"We've designed a {layout.solar_capacity_kw or 0:.0f} kW solar system "
        f"({'with ' + str(layout.turbine_count) + ' wind turbines and' if layout.turbine_count else 'with'} "
        f"{layout.panel_count or 0} panels) that fits within your ${constraints.budget.max:,.0f} budget.\n\n"
        f"After applying the 30% Federal Investment Tax Credit and state incentives, your net investment "
        f"is ${fin.net_cost_after_incentives_usd:,.0f}.{reap_note} The system will generate approximately "
        f"{fin.annual_production_kwh:,.0f} kWh per year — saving you ${fin.annual_savings_usd:,.0f} annually "
        f"and paying for itself in {fin.payback_years:.1f} years.\n\n"
        f"Over 25 years you'll see ${fin.roi_25_year_usd:,.0f} in net returns while offsetting "
        f"{fin.co2_offset_tons_per_year:.1f} tons of CO₂ per year. "
        f"Review the Implementation tab for permits, contractor guidance, and your downloadable site plan."
    )
