from pydantic import BaseModel, Field
from typing import Optional, Literal
from enum import Enum


# ─────────────────────────────────────────
# Shared primitives
# ─────────────────────────────────────────

Coordinate = tuple[float, float]  # (lat, lng)
Polygon = list[Coordinate]


# ─────────────────────────────────────────
# Constraints (mirrors TerraWatt PRD)
# ─────────────────────────────────────────

class FinancingType(str, Enum):
    cash = "cash"
    loan = "loan"
    lease = "lease"
    undecided = "undecided"


class PrimaryGoal(str, Enum):
    offset = "offset"
    income = "income"
    independence = "independence"
    environmental = "environmental"


class GridConnection(str, Enum):
    connected = "connected"
    offgrid = "offgrid"
    hybrid = "hybrid"


class MaintenanceCapacity(str, Enum):
    diy = "diy"
    full_service = "full-service"
    mixed = "mixed"


class Timeline(str, Enum):
    asap = "asap"
    this_year = "this-year"
    one_to_two_years = "1-2-years"
    exploring = "exploring"


class BudgetConstraint(BaseModel):
    min: float = Field(..., ge=0, description="Minimum budget in USD")
    max: float = Field(..., ge=0, description="Maximum budget in USD")
    financing: FinancingType = FinancingType.undecided
    payback_priority: int = Field(50, ge=0, le=100, description="0=lower upfront, 100=faster ROI")


class EnergyConstraint(BaseModel):
    primary_goal: PrimaryGoal = PrimaryGoal.offset
    target_production_kwh_month: Optional[float] = None
    grid_connection: GridConnection = GridConnection.connected


class LandConstraint(BaseModel):
    exclusion_zones: list[Polygon] = Field(default_factory=list)
    existing_structures: list[str] = Field(default_factory=list)
    current_use: list[str] = Field(default_factory=list)


class TechnicalConstraint(BaseModel):
    technologies: list[Literal["solar", "wind", "storage", "hydro"]] = ["solar"]
    aesthetic_concern: int = Field(50, ge=0, le=100)
    maintenance_capacity: MaintenanceCapacity = MaintenanceCapacity.mixed


class PlanConstraints(BaseModel):
    budget: BudgetConstraint
    energy: EnergyConstraint
    land: LandConstraint = LandConstraint()
    technical: TechnicalConstraint = TechnicalConstraint()
    timeline: Timeline = Timeline.exploring


# ─────────────────────────────────────────
# Area
# ─────────────────────────────────────────

class AreaData(BaseModel):
    coordinates: Polygon = Field(..., description="Polygon vertices as (lat, lng) pairs")
    center: Coordinate
    area_acres: float
    address: Optional[str] = None


# ─────────────────────────────────────────
# Analysis request
# ─────────────────────────────────────────

class AnalyzeRequest(BaseModel):
    area: AreaData
    constraints: PlanConstraints


# ─────────────────────────────────────────
# Google Solar API mirror types
# ─────────────────────────────────────────

class RoofSegment(BaseModel):
    pitch_degrees: float
    azimuth_degrees: float
    area_m2: float
    sunshine_quantiles: list[float]
    score: Optional[float] = None  # computed by us


class SolarInsights(BaseModel):
    max_array_panels_count: int
    max_sunshine_hours_per_year: float
    carbon_offset_factor_kg_per_mwh: float
    roof_segments: list[RoofSegment]
    max_annual_kwh: float


# ─────────────────────────────────────────
# Equipment
# ─────────────────────────────────────────

class EquipmentItem(BaseModel):
    id: str
    category: Literal["solar", "wind", "storage", "bos", "installation"]
    type: str
    model: str
    manufacturer: str
    specs: dict
    quantity: int
    unit_price_usd: float
    total_price_usd: float
    position: Optional[Coordinate] = None
    reasoning: str


# ─────────────────────────────────────────
# Financial projection
# ─────────────────────────────────────────

class MonthlyProduction(BaseModel):
    month: int
    kwh: float


class FinancialProjection(BaseModel):
    total_system_cost_usd: float
    net_cost_after_incentives_usd: float
    federal_itc_usd: float            # 30% ITC
    usda_reap_eligible: bool
    state_incentives_usd: float
    annual_production_kwh: float
    annual_savings_usd: float
    payback_years: float
    roi_25_year_usd: float
    co2_offset_tons_per_year: float
    monthly_production: list[MonthlyProduction]
    capex_breakdown: dict[str, float]  # category → cost


# ─────────────────────────────────────────
# Optimal layout
# ─────────────────────────────────────────

class SystemLayout(BaseModel):
    recommended_technologies: list[str]
    solar_capacity_kw: Optional[float] = None
    wind_capacity_kw: Optional[float] = None
    storage_capacity_kwh: Optional[float] = None
    panel_count: Optional[int] = None
    turbine_count: Optional[int] = None
    usable_area_m2: float
    coverage_pct: float
    layout_notes: str


# ─────────────────────────────────────────
# Permit
# ─────────────────────────────────────────

class Permit(BaseModel):
    name: str
    description: str
    typical_cost_usd: float
    typical_timeline_weeks: int
    required_documents: list[str]
    status: Literal["not_started", "in_progress", "approved"] = "not_started"


# ─────────────────────────────────────────
# Full analysis response
# ─────────────────────────────────────────

class AnalysisResult(BaseModel):
    solar_insights: Optional[SolarInsights] = None
    layout: SystemLayout
    equipment: list[EquipmentItem]
    financials: FinancialProjection
    permits: list[Permit]
    agent_summary: str               # Human-readable summary from Gemini
    scenario_comparison: Optional[dict] = None  # max_output vs cost_optimized


# ─────────────────────────────────────────
# Plans CRUD
# ─────────────────────────────────────────

class PlanStatus(str, Enum):
    draft = "draft"
    analyzing = "analyzing"
    complete = "complete"


class CreatePlanRequest(BaseModel):
    name: str
    area: AreaData
    constraints: PlanConstraints


class PlanRecord(BaseModel):
    id: str
    user_id: str
    name: str
    status: PlanStatus
    area: AreaData
    constraints: PlanConstraints
    analysis: Optional[AnalysisResult] = None
    created_at: str
    updated_at: str


# ─────────────────────────────────────────
# Google Solar API — raw passthrough
# ─────────────────────────────────────────

class BuildingInsightsRequest(BaseModel):
    lat: float
    lng: float


class DataLayersRequest(BaseModel):
    lat: float
    lng: float
    radius_meters: float = 100
