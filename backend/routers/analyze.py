"""
Analysis router.

POST /api/analyze        → full Canopy analysis (solar → scorer → Gemini)
GET  /api/analyze/stream → SSE stream of agent phase messages for the sidebar
"""

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
import traceback

from models.schemas import AnalysisRequest, AnalysisResult
from services.solar_service import fetch_solar_summary
from services.canopy_scorer import score_and_rank_options, calculate_community_bonus
from services.agent_service import (
    stream_agent_phases,
    generate_summary,
    build_dashboard_input,
    generate_dashboard_analysis,
)

router = APIRouter()


@router.post("", response_model=AnalysisResult)
async def analyze(request: AnalysisRequest):
    """
    Flow:
      1. (Optional) enrich with Google Solar buildingInsights for the roof
      2. Run the Canopy scoring engine → ranked options
      3. Compute the community aggregator bonus
      4. Assemble the structured analysis input (no API keys) and ask Gemini
         for the full structured dashboard JSON (falls back deterministically)
      5. Return AnalysisResult, including the dashboard the frontend renders
    """
    building = request.building
    preferences = request.preferences

    # ── Step 1: Google Solar (non-fatal enrichment) ──────────────────────
    # The GOOGLE_SOLAR_KEY is used here, server-side only. Only the resulting
    # summary (never the key) flows onward to scoring and to Gemini.
    solar_insights = await fetch_solar_summary(building.lat, building.lng)

    # ── Step 2 + 3: Canopy scoring + community ───────────────────────────
    try:
        ranked = score_and_rank_options(building, preferences)
        community = calculate_community_bonus(building)
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Scoring error: {e}")

    # ── Step 4: Gemini dashboard JSON (structured, with fallback) ────────
    dashboard_input = build_dashboard_input(
        building, preferences, ranked, community, solar_insights
    )
    dashboard_analysis = await generate_dashboard_analysis(dashboard_input)

    # Keep the original natural-language summary for backwards compatibility,
    # preferring the advisor summary Gemini already wrote for the dashboard.
    agent_summary = dashboard_analysis.get("advisorSummary") or await generate_summary(
        building, preferences, ranked, community
    )

    # ── Step 5: Result ───────────────────────────────────────────────────
    return AnalysisResult(
        building=building,
        preferences=preferences,
        rankedOptions=ranked,
        communityBonus=community,
        agentSummary=agent_summary,
        solarInsights=solar_insights,
        dashboardAnalysis=dashboard_analysis,
    )


@router.get("/stream")
async def stream_analysis():
    """
    SSE endpoint for the agent sidebar animation. The frontend opens this
    stream while the analysis runs to show live "thinking" messages.
    """
    return StreamingResponse(
        stream_agent_phases(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
