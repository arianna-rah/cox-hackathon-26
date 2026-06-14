"""
Optimization engine.

Takes the parsed SolarInsights + user constraints and produces:
  - SystemLayout  (what to build, where, capacity)
  - list[EquipmentItem]  (bill of materials)
  - FinancialProjection  (ROI, payback, incentives)
  - list[Permit]

For rooftop apps the flow is:
  1. Score each roof segment (done in solar_service.parse_building_insights)
  2. Allocate segments to solar vs. alternate uses (garden, etc.)
  3. Size the system based on the chosen panel config
  4. Build BOM from system specs
  5. Run financial model

For TerraWatt (farm land), the same engine works but uses
area_acres instead of roof segments.
"""

import math
import uuid
from typing import Optional
from models.schemas import (
    AnalyzeRequest,
    SolarInsights,
    SystemLayout,
    EquipmentItem,
    FinancialProjection,
    MonthlyProduction,
    Permit,
)


# ─────────────────────────────────────────
# Constants
# ─────────────────────────────────────────

PANEL_WATTS = 400           # W per panel
PANEL_AREA_M2 = 2.0         # m² per panel
COST_PER_WATT = 2.50        # $/W installed (US average 2025)
ELECTRICITY_RATE = 0.13     # $/kWh (US avg)
INVERTER_COST_PER_KW = 180  # $/kW
BATTERY_COST_PER_KWH = 350  # $/kWh usable
WIND_TURBINE_COST = 50_000  # $ per 10kW turbine
FEDERAL_ITC = 0.30          # 30% Investment Tax Credit

# Monthly irradiance weight (relative seasonal variation, sums to 12)
MONTHLY_WEIGHTS = [0.60, 0.70, 0.85, 0.95, 1.10, 1.20,
                   1.25, 1.20, 1.05, 0.90, 0.65, 0.55]


def optimize(
    request: AnalyzeRequest,
    solar_insights: Optional[SolarInsights],
    chosen_panel_config: Optional[dict],
) -> tuple[SystemLayout, list[EquipmentItem], FinancialProjection, list[Permit]]:
    """
    Master optimizer. Returns (layout, equipment, financials, permits).
    Works for both rooftop (solar_insights provided) and land (area_acres used).
    """
    constraints = request.constraints
    area = request.area
    budget_max = constraints.budget.max
    techs = constraints.technical.technologies
    goal = constraints.energy.primary_goal

    # ── 1. Determine usable area ──────────────────────────────────────────
    # For rooftop: sum best-scored segments minus exclusion area
    # For land: total acreage minus exclusions (estimated 30% setbacks/paths)
    if solar_insights and solar_insights.roof_segments:
        total_roof_m2 = sum(s.area_m2 for s in solar_insights.roof_segments)
        # Use segments that score above 0.5 (good sun + orientation)
        usable_m2 = sum(
            s.area_m2 for s in solar_insights.roof_segments if (s.score or 0) >= 0.5
        )
        if usable_m2 == 0:
            usable_m2 = total_roof_m2  # fallback: use all
        is_rooftop = True
    else:
        # Land-based: 1 acre = 4047 m², allow ~60% for solar (paths, setbacks)
        usable_m2 = area.area_acres * 4047 * 0.60
        is_rooftop = False

    # ── 2. Solar sizing ───────────────────────────────────────────────────
    solar_kw = 0.0
    panel_count = 0

    if "solar" in techs:
        if chosen_panel_config:
            # Use Google's pre-computed config
            panel_count = chosen_panel_config.get("panelsCount", 0)
            annual_kwh = chosen_panel_config.get("yearlyEnergyDcKwh", 0)
            solar_kw = (panel_count * PANEL_WATTS) / 1000
        else:
            # Fallback: pack panels into usable area
            max_panels_by_area = int(usable_m2 / PANEL_AREA_M2)
            max_panels_by_budget = int((budget_max * 0.85) / (PANEL_WATTS * COST_PER_WATT))
            panel_count = min(max_panels_by_area, max_panels_by_budget)
            solar_kw = (panel_count * PANEL_WATTS) / 1000
            # Estimate: 4 peak sun hours average
            annual_kwh = solar_kw * 4.0 * 365

    # ── 3. Wind sizing ────────────────────────────────────────────────────
    wind_kw = 0.0
    turbine_count = 0
    if "wind" in techs and not is_rooftop and area.area_acres >= 1.0:
        # Rule of thumb: 1 turbine per acre minimum, 10kW each
        budget_for_wind = max(0, budget_max - (solar_kw * 1000 * COST_PER_WATT))
        turbine_count = min(int(area.area_acres), int(budget_for_wind / WIND_TURBINE_COST))
        wind_kw = turbine_count * 10.0

    # ── 4. Battery storage ────────────────────────────────────────────────
    storage_kwh = 0.0
    if "storage" in techs or constraints.energy.grid_connection in ("offgrid", "hybrid"):
        # Size to cover ~6 hours of average production
        daily_kwh = (solar_kw * 4.0 + wind_kw * 3.0)  # rough daily gen
        storage_kwh = min(daily_kwh * 0.5, budget_max * 0.15 / BATTERY_COST_PER_KWH)
        storage_kwh = max(storage_kwh, 0)

    # ── 5. Annual production ──────────────────────────────────────────────
    if "solar" in techs:
        if not chosen_panel_config:
            solar_annual_kwh = solar_kw * 4.0 * 365
        else:
            solar_annual_kwh = chosen_panel_config.get("yearlyEnergyDcKwh", solar_kw * 4.0 * 365)
    else:
        solar_annual_kwh = 0.0

    wind_annual_kwh = wind_kw * 2500  # ~2500 full-load hours/year for moderate wind
    total_annual_kwh = solar_annual_kwh + wind_annual_kwh

    # ── 6. Layout object ──────────────────────────────────────────────────
    coverage_pct = min(100.0, (panel_count * PANEL_AREA_M2 / usable_m2) * 100) if usable_m2 > 0 else 0
    layout = SystemLayout(
        recommended_technologies=[t for t in ["solar", "wind", "storage"] if t in techs or (t == "storage" and storage_kwh > 0)],
        solar_capacity_kw=solar_kw if solar_kw > 0 else None,
        wind_capacity_kw=wind_kw if wind_kw > 0 else None,
        storage_capacity_kwh=storage_kwh if storage_kwh > 0 else None,
        panel_count=panel_count if panel_count > 0 else None,
        turbine_count=turbine_count if turbine_count > 0 else None,
        usable_area_m2=round(usable_m2, 1),
        coverage_pct=round(coverage_pct, 1),
        layout_notes=_layout_notes(is_rooftop, solar_insights, goal),
    )

    # ── 7. Equipment BOM ──────────────────────────────────────────────────
    equipment = _build_bom(solar_kw, panel_count, wind_kw, turbine_count, storage_kwh)

    # ── 8. Financials ─────────────────────────────────────────────────────
    financials = _build_financials(
        equipment, total_annual_kwh, solar_kw + wind_kw, constraints
    )

    # ── 9. Permits ────────────────────────────────────────────────────────
    permits = _standard_permits(is_rooftop, solar_kw + wind_kw)

    return layout, equipment, financials, permits


# ─────────────────────────────────────────
# BOM builder
# ─────────────────────────────────────────

def _build_bom(
    solar_kw: float,
    panel_count: int,
    wind_kw: float,
    turbine_count: int,
    storage_kwh: float,
) -> list[EquipmentItem]:
    items: list[EquipmentItem] = []

    if panel_count > 0:
        # Panels
        items.append(EquipmentItem(
            id=str(uuid.uuid4()),
            category="solar",
            type="solar_panel",
            model="REC Alpha Pure-R 400W",
            manufacturer="REC Group",
            specs={"wattage": 400, "efficiency": 0.215, "dimensions_mm": "1821x1016x30"},
            quantity=panel_count,
            unit_price_usd=280,
            total_price_usd=280 * panel_count,
            reasoning="High-efficiency monocrystalline panel with 25-year performance warranty. Best $/W for mixed residential/commercial scale.",
        ))
        # String inverter (≤30kW) or central (>30kW)
        if solar_kw <= 30:
            inv_model, inv_price = "SolarEdge SE10000H", 1200
        else:
            inv_model, inv_price = "Fronius Symo 30.0-3-M", 3800
        inv_qty = max(1, math.ceil(solar_kw / 30))
        items.append(EquipmentItem(
            id=str(uuid.uuid4()),
            category="solar",
            type="string_inverter",
            model=inv_model,
            manufacturer="SolarEdge" if solar_kw <= 30 else "Fronius",
            specs={"capacity_kw": min(solar_kw, 30), "efficiency": 0.985, "monitoring": True},
            quantity=inv_qty,
            unit_price_usd=inv_price,
            total_price_usd=inv_price * inv_qty,
            reasoning="Grid-tie inverter sized to array capacity. Includes monitoring portal.",
        ))
        # Mounting
        items.append(EquipmentItem(
            id=str(uuid.uuid4()),
            category="solar",
            type="racking",
            model="IronRidge XR-100",
            manufacturer="IronRidge",
            specs={"type": "flush_mount", "max_wind_mph": 130},
            quantity=panel_count,
            unit_price_usd=35,
            total_price_usd=35 * panel_count,
            reasoning="UL-listed aluminum rail system; compatible with most panel models.",
        ))

    if turbine_count > 0:
        items.append(EquipmentItem(
            id=str(uuid.uuid4()),
            category="wind",
            type="wind_turbine",
            model="Bergey Excel 10",
            manufacturer="Bergey Windpower",
            specs={"capacity_kw": 10, "hub_height_m": 37, "rotor_diameter_m": 7},
            quantity=turbine_count,
            unit_price_usd=35_000,
            total_price_usd=35_000 * turbine_count,
            reasoning="Industry-leading small wind turbine with 10-year warranty. USDA REAP eligible.",
        ))

    if storage_kwh > 0:
        battery_units = max(1, math.ceil(storage_kwh / 13.5))
        items.append(EquipmentItem(
            id=str(uuid.uuid4()),
            category="storage",
            type="battery",
            model="Tesla Powerwall 3",
            manufacturer="Tesla",
            specs={"capacity_kwh": 13.5, "peak_power_kw": 11.5, "warranty_years": 10},
            quantity=battery_units,
            unit_price_usd=9_200,
            total_price_usd=9_200 * battery_units,
            reasoning="Integrated AC-coupled battery. No separate inverter needed. 10-year/70% capacity warranty.",
        ))

    # Balance of system (wiring, conduit, monitoring, disconnect)
    total_equip = sum(i.total_price_usd for i in items)
    bos_cost = total_equip * 0.12
    items.append(EquipmentItem(
        id=str(uuid.uuid4()),
        category="bos",
        type="balance_of_system",
        model="Misc BOS Kit",
        manufacturer="Various",
        specs={"includes": ["combiner_box", "disconnect_switch", "conduit", "monitoring", "grounding"]},
        quantity=1,
        unit_price_usd=bos_cost,
        total_price_usd=bos_cost,
        reasoning="All wiring, conduit, monitoring hardware, and safety disconnects. ~12% of equipment cost is standard.",
    ))

    return items


# ─────────────────────────────────────────
# Financial model
# ─────────────────────────────────────────

def _build_financials(
    equipment: list[EquipmentItem],
    annual_kwh: float,
    total_kw: float,
    constraints: AnalyzeRequest.model_fields["constraints"].annotation,
) -> FinancialProjection:
    equip_cost = sum(i.total_price_usd for i in equipment)
    install_cost = total_kw * 1000 * 0.80  # ~$0.80/W labor
    permit_cost = 1_500
    contingency = (equip_cost + install_cost) * 0.10
    total_cost = equip_cost + install_cost + permit_cost + contingency

    federal_itc = total_cost * FEDERAL_ITC
    # USDA REAP: up to 50% for rural energy (farmers qualify if ≥50% ag income)
    usda_eligible = constraints.land.current_use and any(
        u in ("Active farming", "Grazing") for u in constraints.land.current_use
    )
    state_incentives = total_cost * 0.05  # conservative 5% state average
    net_cost = total_cost - federal_itc - state_incentives

    annual_savings = annual_kwh * ELECTRICITY_RATE
    payback_years = (net_cost / annual_savings) if annual_savings > 0 else 99
    roi_25 = (annual_savings * 25) - net_cost

    carbon_kg = annual_kwh * 0.386  # US avg grid emission factor kg CO2/kWh
    carbon_tons = carbon_kg / 1000

    monthly = [
        MonthlyProduction(month=i + 1, kwh=round(annual_kwh * w / 12, 1))
        for i, w in enumerate(MONTHLY_WEIGHTS)
    ]

    capex_breakdown = {
        "equipment": round(equip_cost, 2),
        "installation": round(install_cost, 2),
        "permits": round(permit_cost, 2),
        "contingency": round(contingency, 2),
    }

    return FinancialProjection(
        total_system_cost_usd=round(total_cost, 2),
        net_cost_after_incentives_usd=round(net_cost, 2),
        federal_itc_usd=round(federal_itc, 2),
        usda_reap_eligible=usda_eligible,
        state_incentives_usd=round(state_incentives, 2),
        annual_production_kwh=round(annual_kwh, 1),
        annual_savings_usd=round(annual_savings, 2),
        payback_years=round(payback_years, 1),
        roi_25_year_usd=round(roi_25, 2),
        co2_offset_tons_per_year=round(carbon_tons, 2),
        monthly_production=monthly,
        capex_breakdown=capex_breakdown,
    )


# ─────────────────────────────────────────
# Permits
# ─────────────────────────────────────────

def _standard_permits(is_rooftop: bool, total_kw: float) -> list[Permit]:
    permits = [
        Permit(
            name="Building Permit",
            description="Required for structural modifications. For rooftop solar this covers roof penetrations and racking attachment.",
            typical_cost_usd=500,
            typical_timeline_weeks=2,
            required_documents=["Site plan", "Structural calculations", "Equipment spec sheets"],
        ),
        Permit(
            name="Electrical Permit",
            description="Covers all AC/DC wiring, inverter installation, and meter upgrade if needed.",
            typical_cost_usd=300,
            typical_timeline_weeks=1,
            required_documents=["Single-line diagram", "Equipment list", "Load calculation"],
        ),
        Permit(
            name="Utility Interconnection Agreement",
            description="Required before energizing. Utility reviews your system and updates billing to net metering.",
            typical_cost_usd=100,
            typical_timeline_weeks=8,
            required_documents=["Interconnection application", "Inverter spec sheet", "Utility company form"],
        ),
    ]
    if not is_rooftop:
        permits.append(Permit(
            name="Zoning / Land Use Permit",
            description="Agricultural land may need a special use permit for commercial-scale renewable installations.",
            typical_cost_usd=750,
            typical_timeline_weeks=4,
            required_documents=["Site plan", "Environmental checklist", "Neighbor notification (varies by county)"],
        ))
    if total_kw >= 100:
        permits.append(Permit(
            name="Environmental Review (NEPA/SEPA)",
            description="Systems above 100kW may trigger state or federal environmental review, especially near wetlands.",
            typical_cost_usd=2_500,
            typical_timeline_weeks=12,
            required_documents=["Environmental impact assessment", "Species survey", "Stormwater plan"],
        ))
    return permits


def _layout_notes(is_rooftop: bool, insights: Optional[SolarInsights], goal: str) -> str:
    if is_rooftop and insights:
        top = insights.roof_segments[0] if insights.roof_segments else None
        if top:
            az = top.azimuth_degrees
            direction = "south" if 135 <= az <= 225 else ("east" if az < 135 else "west")
            return (
                f"Best roof segment faces {direction} at {top.pitch_degrees:.0f}° pitch "
                f"(score: {top.score:.2f}). Panels concentrated on high-sun segments; "
                f"shaded/north-facing areas reserved for green roof or skylights."
            )
    if goal == "income":
        return "Ground-mount array optimized for maximum production per acre. Rows spaced for bifacial gain and maintenance access."
    return "System sized to offset primary energy usage within budget. Dual-tilt ground mount with 15° inter-row spacing."
