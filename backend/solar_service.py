"""
Google Solar API service.

Docs: https://developers.google.com/maps/documentation/solar/overview
Endpoints used:
  - buildingInsights: roof geometry, sunshine hours, panel configs
  - dataLayers: raster tiles for flux/shade overlays on the map
"""

import os
import math
import httpx
from typing import Optional
from models.schemas import SolarInsights, RoofSegment


SOLAR_API_BASE = "https://solar.googleapis.com/v1"
API_KEY = os.environ.get("GOOGLE_SOLAR_API_KEY", "")


async def get_building_insights(lat: float, lng: float) -> dict:
    """
    Calls Google Solar buildingInsights for a lat/lng.
    Returns the raw API response dict for maximum flexibility.

    The key fields we use downstream:
      - solarPotential.maxArrayPanelsCount
      - solarPotential.maxSunshineHoursPerYear
      - solarPotential.carbonOffsetFactorKgPerMwh
      - solarPotential.roofSegmentStats[]
      - solarPotential.solarPanelConfigs[]
      - solarPotential.wholeRoofStats
    """
    url = f"{SOLAR_API_BASE}/buildingInsights:findClosest"
    params = {
        "location.latitude": lat,
        "location.longitude": lng,
        "requiredQuality": "LOW",   # LOW = wider coverage; use MEDIUM/HIGH for precision
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
    Fetches Solar data layer URLs (GeoTIFFs) for map overlays.

    Returns URLs for:
      - annualFlux  → yearly sun per m² (render as yellow-orange heatmap)
      - monthlyFlux → 12 monthly flux tiles
      - hourlyShade → shade mask by hour
      - dsm         → digital surface model (elevation)
      - rgb         → satellite imagery

    The frontend uses these URLs to render overlays via the Leaflet
    tile layer or a canvas renderer. The tiles are served directly
    from Google's CDN and require the API key appended as ?key=...
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


def parse_building_insights(raw: dict) -> SolarInsights:
    """
    Converts raw buildingInsights JSON into our internal SolarInsights model.

    Segment scoring logic:
      score = (sunshine_quantile_p75 / max_sunshine)
              * azimuth_bonus(azimuth_degrees)
              * tilt_bonus(pitch_degrees)

    azimuth_bonus: south-facing (180°) = 1.0; north (0°/360°) = 0.6
    tilt_bonus: 15–35° optimal for most US latitudes = 1.0; flat = 0.7
    """
    sp = raw.get("solarPotential", {})
    max_sunshine = sp.get("maxSunshineHoursPerYear", 1)

    segments: list[RoofSegment] = []
    for seg in sp.get("roofSegmentStats", []):
        pitch = seg.get("pitchDegrees", 0)
        azimuth = seg.get("azimuthDegrees", 180)
        quantiles = seg.get("stats", {}).get("sunshineQuantiles", [0] * 11)
        area = seg.get("stats", {}).get("areaMeters2", 0)

        p75 = quantiles[7] if len(quantiles) > 7 else (quantiles[-1] if quantiles else 0)

        # Azimuth bonus: peaks at south (180°), cosine-shaped
        az_rad = math.radians(azimuth - 180)
        azimuth_bonus = 0.7 + 0.3 * math.cos(az_rad)

        # Tilt bonus: 15-35° is optimal
        if 15 <= pitch <= 35:
            tilt_bonus = 1.0
        elif pitch < 15:
            tilt_bonus = 0.7 + 0.3 * (pitch / 15)
        else:
            tilt_bonus = max(0.6, 1.0 - (pitch - 35) * 0.01)

        score = (p75 / max_sunshine) * azimuth_bonus * tilt_bonus if max_sunshine else 0

        segments.append(RoofSegment(
            pitch_degrees=pitch,
            azimuth_degrees=azimuth,
            area_m2=area,
            sunshine_quantiles=quantiles,
            score=round(score, 4),
        ))

    # Sort best segments first
    segments.sort(key=lambda s: s.score or 0, reverse=True)

    # Best panel config = highest kWh within budget is handled in optimizer,
    # here we store max potential
    configs = sp.get("solarPanelConfigs", [])
    max_kwh = max((c.get("yearlyEnergyDcKwh", 0) for c in configs), default=0)

    return SolarInsights(
        max_array_panels_count=sp.get("maxArrayPanelsCount", 0),
        max_sunshine_hours_per_year=max_sunshine,
        carbon_offset_factor_kg_per_mwh=sp.get("carbonOffsetFactorKgPerMwh", 400),
        roof_segments=segments,
        max_annual_kwh=max_kwh,
    )


def pick_optimal_panel_config(raw: dict, budget_max: float, payback_priority: int) -> Optional[dict]:
    """
    Selects the best solarPanelConfig from buildingInsights.

    Strategy:
      - Filter configs whose estimated cost is within budget_max
        (rough estimate: $2.50/W installed, panels ~400W each)
      - If payback_priority > 60: maximize kWh/dollar (best ROI)
      - If payback_priority <= 60: maximize raw kWh (max production)

    Returns the chosen config dict or None if no configs available.
    """
    COST_PER_WATT = 2.50
    PANEL_WATTS = 400

    configs = raw.get("solarPotential", {}).get("solarPanelConfigs", [])
    if not configs:
        return None

    affordable = []
    for cfg in configs:
        n_panels = cfg.get("panelsCount", 0)
        est_cost = n_panels * PANEL_WATTS * COST_PER_WATT
        if est_cost <= budget_max:
            kwh = cfg.get("yearlyEnergyDcKwh", 0)
            roi_score = kwh / est_cost if est_cost > 0 else 0
            affordable.append({**cfg, "_est_cost": est_cost, "_roi_score": roi_score})

    if not affordable:
        # Take the smallest config if nothing fits budget
        affordable = sorted(configs, key=lambda c: c.get("panelsCount", 0))[:1]
        for cfg in affordable:
            n = cfg.get("panelsCount", 0)
            cfg["_est_cost"] = n * PANEL_WATTS * COST_PER_WATT
            cfg["_roi_score"] = cfg.get("yearlyEnergyDcKwh", 0) / cfg["_est_cost"] if cfg["_est_cost"] else 0

    if payback_priority > 60:
        # Best ROI per dollar
        return max(affordable, key=lambda c: c["_roi_score"])
    else:
        # Maximum production
        return max(affordable, key=lambda c: c.get("yearlyEnergyDcKwh", 0))
