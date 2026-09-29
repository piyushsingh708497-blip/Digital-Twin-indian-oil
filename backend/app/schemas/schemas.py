"""
OIL-TWIN AI - Pydantic Schemas
Request/Response models for API validation
"""
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

# ── Well Schemas ──────────────────────────────────────────────────────────────

class WellBase(BaseModel):
    well_id: str
    name: str
    field: str = "Baghewala"
    latitude: float | None = None
    longitude: float | None = None
    depth_m: float | None = None
    status: str = "Active"


class WellResponse(WellBase):
    id: int
    health_status: str
    health_score: float
    created_at: datetime | None = None

    class Config:
        from_attributes = True


class WellSummary(BaseModel):
    well_id: str
    name: str
    health_status: str
    health_score: float
    oil_rate_m3d: float | None = None
    reservoir_temp_c: float | None = None
    viscosity_cp: float | None = None
    pump_efficiency_pct: float | None = None
    steam_oil_ratio: float | None = None
    risk_score: float | None = None
    last_updated: str | None = None


# ── Telemetry / Dashboard ──────────────────────────────────────────────────────

class TelemetryResponse(BaseModel):
    timestamp: str | None = None
    reservoir_temp_c: float
    reservoir_pressure_kpa: float
    oil_viscosity_cp: float
    wellbore_temp_c: float
    wellbore_pressure_kpa: float
    steam_volume_m3: float
    injection_pressure_kpa: float
    soak_time_days: float
    css_cycle_number: int
    stroke_length_m: float
    spm: float
    vfd_hz: float
    pump_efficiency_pct: float
    oil_rate_m3d: float
    water_rate_m3d: float
    energy_kwh: float
    energy_per_barrel_kwh: float
    steam_oil_ratio: float
    rod_floating_risk: float
    impact_loading_risk: float
    pump_unsetting_risk: float
    rod_failure_risk: float

    class Config:
        from_attributes = True


class DashboardResponse(BaseModel):
    well: WellResponse
    latest_telemetry: TelemetryResponse
    production_trend: list[dict[str, Any]]
    temperature_trend: list[dict[str, Any]]
    steam_vs_production: list[dict[str, Any]]
    energy_trend: list[dict[str, Any]]
    equipment_health: dict[str, Any]
    ai_recommendation: str
    alerts_count: int


# ── CSS Schemas ────────────────────────────────────────────────────────────────

class CSSSimulateRequest(BaseModel):
    well_id: str
    steam_volume_m3: float = Field(ge=100, le=5000, description="Steam volume in m³")
    injection_pressure_kpa: float = Field(ge=1000, le=15000, description="Injection pressure kPa")
    soak_time_days: float = Field(ge=1, le=30, description="Soak period in days")
    production_cutoff_m3d: float = Field(ge=0.5, le=10, description="Production cutoff m³/day")
    cycle_number: int = Field(ge=1, le=20)
    current_reservoir_temp_c: float = Field(ge=20, le=250)
    current_viscosity_cp: float = Field(ge=10, le=50000)


class CSSSimulateResponse(BaseModel):
    reservoir_temp_peak_c: float
    reservoir_temp_after_soak_c: float
    predicted_oil_m3: float
    predicted_peak_rate_m3d: float
    production_duration_days: float
    energy_kwh: float
    sor: float
    confidence: float
    heating_profile: list[dict[str, Any]]
    disclaimer: str = "Synthetic demonstration model — not validated for Baghewala field."


class CSSOptimizeResponse(BaseModel):
    best_params: dict[str, Any]
    best_score: float
    predicted_production_m3: float
    predicted_sor: float
    predicted_energy_kwh: float
    alternatives: list[dict[str, Any]]
    explanation: list[str]
    disclaimer: str = "Simulation Recommendation — validate against field engineering constraints before operational use."


# ── SRP Schemas ────────────────────────────────────────────────────────────────

class SRPSimulateRequest(BaseModel):
    well_id: str
    stroke_length_m: float = Field(ge=1.0, le=6.0)
    spm: float = Field(ge=1.0, le=20.0)
    vfd_hz: float = Field(ge=30.0, le=60.0)
    reservoir_temp_c: float = Field(ge=20, le=250)
    reservoir_pressure_kpa: float = Field(ge=500, le=20000)
    viscosity_cp: float = Field(ge=10, le=50000)
    pump_diameter_mm: float = Field(ge=25, le=75, default=44.45)


class SRPSimulateResponse(BaseModel):
    predicted_rate_m3d: float
    pump_efficiency_pct: float
    energy_kwh_per_day: float
    rod_floating_risk: float
    pump_unsetting_risk: float
    rod_failure_risk: float
    impact_loading_risk: float
    overall_risk_score: float
    risk_reasons: list[str]
    disclaimer: str = "Synthetic demonstration model — not validated for Baghewala field."


class SRPOptimizeResponse(BaseModel):
    best_params: dict[str, Any]
    best_score: float
    predicted_rate_m3d: float
    pump_efficiency_pct: float
    risk_score: float
    alternatives: list[dict[str, Any]]
    explanation: list[str]
    disclaimer: str = "Simulation Recommendation — validate against field engineering constraints before operational use."


# ── Simulation / What-If Schemas ───────────────────────────────────────────────

class WhatIfRequest(BaseModel):
    well_id: str
    scenario_name: str = "Scenario A"
    # CSS
    steam_volume_m3: float = Field(ge=100, le=5000)
    injection_pressure_kpa: float = Field(ge=1000, le=15000)
    soak_time_days: float = Field(ge=1, le=30)
    production_cutoff_m3d: float = Field(ge=0.5, le=10)
    # SRP
    stroke_length_m: float = Field(ge=1.0, le=6.0)
    spm: float = Field(ge=1.0, le=20.0)
    vfd_hz: float = Field(ge=30.0, le=60.0)
    # Context
    current_reservoir_temp_c: float = Field(ge=20, le=250, default=95.0)
    current_viscosity_cp: float = Field(ge=10, le=50000, default=5000.0)
    current_reservoir_pressure_kpa: float = Field(ge=500, le=20000, default=4500.0)
    cycle_number: int = Field(ge=1, le=20, default=5)


class WhatIfResult(BaseModel):
    scenario_name: str
    oil_production_m3: float
    peak_rate_m3d: float
    reservoir_temp_c: float
    viscosity_cp: float
    energy_kwh: float
    energy_per_barrel_kwh: float
    sor: float
    pump_efficiency_pct: float
    rod_floating_risk: float
    rod_failure_risk: float
    pump_unsetting_risk: float
    impact_loading_risk: float
    overall_risk: float
    overall_score: float
    is_recommended: bool = False
    explanation: list[str] = []
    disclaimer: str = "Simulation Recommendation — validate against field engineering constraints before operational use."


# ── Optimization Schemas ───────────────────────────────────────────────────────

class OptimizationRequest(BaseModel):
    well_id: str
    current_reservoir_temp_c: float = Field(ge=20, le=250, default=95.0)
    current_viscosity_cp: float = Field(ge=10, le=50000, default=5000.0)
    current_reservoir_pressure_kpa: float = Field(ge=500, le=20000, default=4500.0)
    cycle_number: int = Field(ge=1, le=20, default=5)
    # Weights (must sum ≈ 1.0)
    weight_production: float = Field(ge=0, le=1, default=0.35)
    weight_efficiency: float = Field(ge=0, le=1, default=0.20)
    weight_energy: float = Field(ge=0, le=1, default=0.20)
    weight_sor: float = Field(ge=0, le=1, default=0.15)
    weight_risk: float = Field(ge=0, le=1, default=0.10)


class OptimizationResponse(BaseModel):
    best_scenario: WhatIfResult
    alternatives: list[WhatIfResult]
    optimization_score: float
    explanation: list[str]
    weights_used: dict[str, float]
    disclaimer: str = "Simulation Recommendation — validate against field engineering constraints before operational use."


# ── Prediction Schemas ─────────────────────────────────────────────────────────

class ProductionPredictRequest(BaseModel):
    reservoir_temp_c: float
    reservoir_pressure_kpa: float
    viscosity_cp: float
    steam_volume_m3: float
    injection_pressure_kpa: float
    soak_time_days: float
    stroke_length_m: float
    spm: float
    vfd_hz: float
    css_cycle_number: int


class PredictionResult(BaseModel):
    predicted_value: float
    confidence: float
    lower_bound: float
    upper_bound: float
    model_note: str = "Prototype ML prediction using synthetic demonstration data."


class RiskPredictRequest(BaseModel):
    viscosity_cp: float
    reservoir_temp_c: float
    reservoir_pressure_kpa: float
    spm: float
    stroke_length_m: float
    vfd_hz: float
    pump_efficiency_pct: float
    oil_rate_m3d: float


class RiskResult(BaseModel):
    rod_floating_risk: float
    impact_loading_risk: float
    pump_unsetting_risk: float
    rod_failure_risk: float
    overall_risk: float
    severity: str  # Low, Medium, High, Critical
    reasons: list[str]


# ── Alert Schemas ──────────────────────────────────────────────────────────────

class AlertResponse(BaseModel):
    id: int
    well_id: int
    alert_type: str
    category: str
    title: str
    message: str
    acknowledged: bool
    resolved: bool
    timestamp: datetime | None = None

    class Config:
        from_attributes = True


# ── Report Schemas ─────────────────────────────────────────────────────────────

class ReportResponse(BaseModel):
    well_id: str
    generated_at: str
    well_state: dict[str, Any]
    css_parameters: dict[str, Any]
    srp_parameters: dict[str, Any]
    production_prediction: dict[str, Any]
    temperature_prediction: dict[str, Any]
    equipment_risk: dict[str, Any]
    energy_metrics: dict[str, Any]
    optimized_scenario: dict[str, Any] | None = None
    explanation: list[str]
    disclaimer: str = "This report is generated from synthetic demonstration data. Validate all recommendations against field engineering constraints before operational use."
