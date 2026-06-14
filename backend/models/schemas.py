"""
Canopy Pydantic models.

These mirror the TypeScript interfaces in cox-hackathon-app/types/index.ts
so the frontend and backend stay in sync. Pydantic v2.
"""

from pydantic import BaseModel, Field
from typing import Optional, Literal


# ─────────────────────────────────────────
# Building
# ─────────────────────────────────────────

BuildingType = Literal["warehouse", "residential", "office", "retail"]


class Building(BaseModel):
    id: str
    name: str
    address: str
    lat: float
    lng: float
    year_built: int = Field(..., alias="yearBuilt")
    building_type: BuildingType = Field(..., alias="buildingType")
    roof_area_sqft: float = Field(..., alias="roofAreaSqFt")
    roof_type: str = Field(..., alias="roofType")
    roof_material: str = Field(..., alias="roofMaterial")
    max_load_psf: float = Field(..., alias="maxLoadPSF")
    sun_exposure_hrs_per_day: float = Field(..., alias="sunExposureHrsPerDay")
    heat_island_intensity_f: float = Field(..., alias="heatIslandIntensityF")
    annual_stormwater_credit_dollars: float = Field(..., alias="annualStormwaterCreditDollars")
    neighbor_ids: list[str] = Field(default_factory=list, alias="neighborIds")
    precomputed_solar_kwh_per_year: float = Field(..., alias="precomputedSolarKwhPerYear")

    model_config = {"populate_by_name": True}


# ─────────────────────────────────────────
# User preferences
# ─────────────────────────────────────────

PrimaryGoal = Literal["savings", "revenue", "environment", "community"]


class UserPreferences(BaseModel):
    budget_dollars: float = Field(..., alias="budgetDollars")
    # 0 = max impact, 1 = fastest ROI
    cost_sensitivity: float = Field(0.5, ge=0, le=1, alias="costSensitivity")
    primary_goal: PrimaryGoal = Field("savings", alias="primaryGoal")

    model_config = {"populate_by_name": True}


# ─────────────────────────────────────────
# Roof options
# ─────────────────────────────────────────

class RoofOption(BaseModel):
    id: str
    name: str
    short_description: str = Field(..., alias="shortDescription")
    full_description: str = Field(..., alias="fullDescription")
    cost_per_sqft: Optional[float] = Field(None, alias="costPerSqFt")
    cost_fixed: Optional[float] = Field(None, alias="costFixed")
    annual_savings_per_sqft: Optional[float] = Field(None, alias="annualSavingsPerSqFt")
    annual_savings_fixed: Optional[float] = Field(None, alias="annualSavingsFixed")
    annual_revenue_fixed: Optional[float] = Field(None, alias="annualRevenueFixed")
    co2_tons_per_sqft_per_year: Optional[float] = Field(None, alias="co2TonsPerSqFtPerYear")
    co2_tons_per_year: Optional[float] = Field(None, alias="co2TonsPerYear")
    structural_load_psf: float = Field(..., alias="structuralLoadPSF")
    feasibility_base: float = Field(..., alias="feasibilityBase")
    rebates: list[str] = Field(default_factory=list)
    warning_flags: list[str] = Field(default_factory=list, alias="warningFlags")
    best_for: str = Field(..., alias="bestFor")

    model_config = {"populate_by_name": True}


class ScoredOption(RoofOption):
    score: float
    feasible: bool
    upfront_cost: float = Field(..., alias="uptrontCost")  # alias matches TS field name
    annual_net_dollars: float = Field(..., alias="annualNetDollars")
    roi_months: int = Field(..., alias="roiMonths")
    warnings_for_building: list[str] = Field(default_factory=list, alias="warningsForBuilding")

    model_config = {"populate_by_name": True}


# ─────────────────────────────────────────
# Community aggregator
# ─────────────────────────────────────────

class CommunityBonus(BaseModel):
    neighbor_count: int = Field(..., alias="neighborCount")
    bulk_discount_pct: float = Field(..., alias="bulkDiscountPct")
    pooled_stormwater_dollars_per_year: float = Field(..., alias="pooledStormwaterDollarsPerYear")
    heat_reduction_f: float = Field(..., alias="heatReductionF")
    city_grant_eligible: bool = Field(..., alias="cityGrantEligible")
    city_grant_dollars: float = Field(..., alias="cityGrantDollars")

    model_config = {"populate_by_name": True}


# ─────────────────────────────────────────
# Analysis request / response
# ─────────────────────────────────────────

class AnalysisRequest(BaseModel):
    building: Building
    preferences: UserPreferences


class AnalysisResult(BaseModel):
    building: Building
    preferences: UserPreferences
    ranked_options: list[ScoredOption] = Field(..., alias="rankedOptions")
    community_bonus: CommunityBonus = Field(..., alias="communityBonus")
    agent_summary: str = Field("", alias="agentSummary")
    solar_insights: Optional[dict] = Field(None, alias="solarInsights")

    model_config = {"populate_by_name": True}
