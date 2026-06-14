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
from services.agent_service import stream_agent_phases, generate_summary

router = APIRouter()


@router.post("", response_model=AnalysisResult)
async def analyze(request: AnalysisRequest):
    """
    Flow:
      1. (Optional) enrich with Google Solar buildingInsights for the roof
      2. Run the Canopy scoring engine → ranked options
      3. Compute the community aggregator bonus
      4. Call Gemini for a natural-language rooftop analysis
      5. Return AnalysisResult
    """
    building = request.building
    preferences = request.preferences

    # ── Step 1: Google Solar (non-fatal enrichment) ──────────────────────
    solar_insights = await fetch_solar_summary(building.lat, building.lng)

    # ── Step 2 + 3: Canopy scoring + community ───────────────────────────
    try:
        ranked = score_and_rank_options(building, preferences)
        community = calculate_community_bonus(building)
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Scoring error: {e}")

    # ── Step 4: Gemini narration (falls back to template) ────────────────
    agent_summary = await generate_summary(building, preferences, ranked, community)

    # ── Step 5: Result ───────────────────────────────────────────────────
    return AnalysisResult(
        building=building,
        preferences=preferences,
        rankedOptions=ranked,
        communityBonus=community,
        agentSummary=agent_summary,
        solarInsights=solar_insights,
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
