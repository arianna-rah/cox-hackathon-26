"""
Geocode router — address search via OpenStreetMap Nominatim (free, no key).

GET /api/geocode?q=<address>  → list of matching places (lat/lng/display_name)

Nominatim usage policy requires a descriptive User-Agent and reasonable rate.
Results are biased toward the Atlanta area for this demo.
"""

import httpx
from fastapi import APIRouter, HTTPException, Query

router = APIRouter()

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
USER_AGENT = "Canopy/1.0 (Cox Hackathon rooftop advisor)"

# Rough Atlanta viewbox (left,top,right,bottom) to bias results
ATLANTA_VIEWBOX = "-84.55,33.89,-84.29,33.65"


@router.get("")
async def geocode(
    q: str = Query(..., min_length=3, description="Address or place to search"),
    limit: int = Query(5, ge=1, le=10),
):
    params = {
        "q": q,
        "format": "json",
        "addressdetails": 1,
        "limit": limit,
        "viewbox": ATLANTA_VIEWBOX,
        "bounded": 0,
    }
    headers = {"User-Agent": USER_AGENT}
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(NOMINATIM_URL, params=params, headers=headers)
            r.raise_for_status()
            raw = r.json()
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Geocoding error: {e}")

    return [
        {
            "display_name": item.get("display_name"),
            "lat": float(item["lat"]),
            "lng": float(item["lon"]),
            "type": item.get("type"),
        }
        for item in raw
    ]
