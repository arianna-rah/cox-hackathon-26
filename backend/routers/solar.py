"""
Solar router — server-side proxy for the Google Solar API.

GET /api/solar?lat=..&lng=..              → summarised building insights
GET /api/solar/layers?lat=..&lng=..       → data-layer tile URLs for overlays

The GOOGLE_SOLAR_KEY is read server-side only (never exposed to the browser).
"""

from fastapi import APIRouter, HTTPException, Query

from services.solar_service import fetch_solar_summary, get_data_layers

router = APIRouter()


@router.get("")
async def solar_insights(
    lat: float = Query(..., description="Latitude"),
    lng: float = Query(..., description="Longitude"),
):
    summary = await fetch_solar_summary(lat, lng)
    if summary is None:
        raise HTTPException(
            status_code=404,
            detail="No solar insights available for this location (or GOOGLE_SOLAR_KEY not set).",
        )
    return summary


@router.get("/layers")
async def solar_layers(
    lat: float = Query(...),
    lng: float = Query(...),
    radius_meters: float = Query(100, ge=10, le=500),
):
    try:
        return await get_data_layers(lat, lng, radius_meters)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Solar data layers error: {e}")
