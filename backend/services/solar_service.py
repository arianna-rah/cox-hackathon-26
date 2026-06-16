"""
Google Solar API service (adapted for Canopy).

Docs: https://developers.google.com/maps/documentation/solar/overview
Endpoints used:
  - buildingInsights: roof geometry, sunshine hours, panel configs
  - dataLayers: raster tiles for flux/shade overlays on the map

The raw insights are summarised into a small dict that the Canopy scorer and
Gemini narrator can consume (sun exposure, max panels, annual kWh, carbon).
"""

import os
import httpx
from typing import Optional


SOLAR_API_BASE = "https://solar.googleapis.com/v1"
API_KEY = os.environ.get("GOOGLE_SOLAR_KEY", "")


async def get_building_insights(lat: float, lng: float) -> dict:
    """
    Calls Google Solar buildingInsights for a lat/lng. Returns the raw API
    response dict. Raises httpx.HTTPStatusError for non-2xx (callers may
    fall back to precomputed data — rural/unmapped buildings often 404).
    """
    url = f"{SOLAR_API_BASE}/buildingInsights:findClosest"
    params = {
        "location.latitude": lat,
        "location.longitude": lng,
        "requiredQuality": "LOW",  # LOW = wider coverage; MEDIUM/HIGH for precision
        "key": API_KEY,
    }
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.get(url, params=params)
        r.raise_for_status()
        return r.json()


async def get_data_layers(
    lat: float,
    lng: float,
    radius_meters: float = 100,
    view: str = "FULL_LAYERS",
) -> dict:
    """
    Fetches Solar data layer URLs (GeoTIFFs) for map overlays:
    annualFlux, monthlyFlux, hourlyShade, dsm, rgb. The frontend can render
    these as heatmap tiles. Tiles require the API key appended as ?key=...
    """
    url = f"{SOLAR_API_BASE}/dataLayers:get"
    params = {
        "location.latitude": lat,
        "location.longitude": lng,
        "radiusMeters": radius_meters,
        "view": view,
        "requiredQuality": "LOW",
        "key": API_KEY,
    }
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.get(url, params=params)
        r.raise_for_status()
        return r.json()


def summarize_for_canopy(raw: dict) -> dict:
    """
    Reduces a raw buildingInsights response into the fields Canopy cares about.

    Returns a flat dict:
      - max_array_panels_count
      - max_sunshine_hours_per_year
      - sun_exposure_hrs_per_day   (derived: sunshine hours / 365)
      - carbon_offset_factor_kg_per_mwh
      - roof_area_m2               (whole-roof stats)
      - max_annual_kwh             (best panel config)
    """
    sp = raw.get("solarPotential", {})
    max_sunshine = sp.get("maxSunshineHoursPerYear", 0)
    whole = sp.get("wholeRoofStats", {})
    configs = sp.get("solarPanelConfigs", [])
    max_kwh = max((c.get("yearlyEnergyDcKwh", 0) for c in configs), default=0)

    # How much of the roof the recommended panel layout covers (the rest is
    # setbacks, edges, equipment, and shaded/wrong-facing segments).
    roof_area_m2 = whole.get("areaMeters2")
    array_area_m2 = sp.get("maxArrayAreaMeters2")
    if not array_area_m2:
        panel_m2 = sp.get("panelWidthMeters", 1.045) * sp.get("panelHeightMeters", 1.879)
        array_area_m2 = sp.get("maxArrayPanelsCount", 0) * panel_m2
    roof_coverage_pct = (
        min(100, max(0, round((array_area_m2 / roof_area_m2) * 100)))
        if roof_area_m2 and array_area_m2 else None
    )

    return {
        "max_array_panels_count": sp.get("maxArrayPanelsCount", 0),
        "max_sunshine_hours_per_year": max_sunshine,
        "sun_exposure_hrs_per_day": round(max_sunshine / 365, 1) if max_sunshine else None,
        "carbon_offset_factor_kg_per_mwh": sp.get("carbonOffsetFactorKgPerMwh", 400),
        "roof_area_m2": roof_area_m2,
        "max_annual_kwh": max_kwh,
        "panel_area_m2": round(array_area_m2) if array_area_m2 else None,
        "roof_coverage_pct": roof_coverage_pct,
    }


async def fetch_solar_summary(lat: float, lng: float) -> Optional[dict]:
    """
    Convenience wrapper: fetch + summarise, returning None on any failure so
    callers can gracefully fall back to precomputed building data.
    """
    if not API_KEY:
        return None
    try:
        raw = await get_building_insights(lat, lng)
        return summarize_for_canopy(raw)
    except Exception as e:  # noqa: BLE001 — non-fatal, Solar API may 404
        print(f"[Solar API] Warning — no insights for ({lat},{lng}): {e}")
        return None
