"""
POST /api/analyze
  → Full analysis: Solar API → optimizer → Gemini summary

GET  /api/analyze/stream
  → SSE stream of agent phase messages (for sidebar animation)
"""

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
import traceback

from models.schemas import AnalyzeRequest, AnalysisResult
from services.solar_service import (
    get_building_insights,
    parse_building_insights,
    pick_optimal_panel_config,
)
from services.optimizer import optimize
from services.agent_service import (
    stream_agent_phases,
    generate_plan_summary,
    generate_scenario_comparison,
)

router = APIRouter()


@router.post("", response_model=AnalysisResult)
async def analyze(request: AnalyzeRequest):
    """
    Core analysis endpoint.

    Flow:
      1. Call Google Solar buildingInsights for the selected area center
      2. Parse roof segments and score them
      3. Pick the optimal panel config within the user's budget
      4. Run the optimizer (layout + BOM + financials + permits)
      5. Call Gemini for a natural-language summary
      6. Return AnalysisResult

    For land-based analysis (area_acres >> rooftop), Solar API may return
    no building — we gracefully fall back to area-based sizing.
    """
    lat, lng = request.area.center

    # ── Step 1: Google Solar API ──────────────────────────────────────────
    solar_insights = None
    chosen_config = None

    try:
        raw = await get_building_insights(lat, lng)
        solar_insights = parse_building_insights(raw)
        chosen_config = pick_optimal_panel_config(
            raw,
            budget_max=request.constraints.budget.max,
            payback_priority=request.constraints.budget.payback_priority,
        )
    except Exception as e:
        # Non-fatal: Solar API may 404 for rural land without mapped buildings
        print(f"[Solar API] Warning — falling back to area-based sizing: {e}")

    # ── Step 2: Optimizer ─────────────────────────────────────────────────
    try:
        layout, equipment, financials, permits = optimize(
            request, solar_insights, chosen_config
        )
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Optimizer error: {e}")

    # ── Step 3: Build result (without Gemini yet) ─────────────────────────
    result = AnalysisResult(
        solar_insights=solar_insights,
        layout=layout,
        equipment=equipment,
        financials=financials,
        permits=permits,
        agent_summary="",  # filled below
    )

    # ── Step 4: Gemini summary + scenario comparison ──────────────────────
    result.agent_summary = await generate_plan_summary(
        request.area, request.constraints, result
    )
    result.scenario_comparison = await generate_scenario_comparison(result, request.constraints)

    return result


@router.get("/stream")
async def stream_analysis():
    """
    SSE endpoint for the agent sidebar animation.

    The frontend opens this stream BEFORE calling POST /analyze,
    so the sidebar shows live "thinking" messages while the analysis runs.

    Usage (Next.js):
      const es = new EventSource('/api/analyze/stream');
      es.onmessage = (e) => {
        const { phase, name, message, done } = JSON.parse(e.data);
        if (done) { es.close(); triggerActualAnalysis(); }
        else { appendToSidebar(phase, name, message); }
      };
    """
    return StreamingResponse(
        stream_agent_phases(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
