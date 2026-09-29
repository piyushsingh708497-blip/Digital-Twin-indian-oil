"""
OIL-TWIN AI - Metadata, System Health, Audit, and State Schemas
"""
from typing import Any, Literal

from pydantic import Field

from app.schemas.alerts import Alert
from app.schemas.common import CamelModel, DataMode, TagQualityStatus
from app.schemas.dyno import DynoCard
from app.schemas.telemetry import Telemetry


class WellStateResponse(CamelModel):
    well_id: str
    telemetry: Telemetry
    dyno_card: DynoCard
    active_alerts: list[Alert]


class DataHealthResponse(CamelModel):
    well_id: str
    healthy: bool = True
    data_age_sec: float
    tag_status: dict[str, TagQualityStatus]
    missing_sensors: list[str]
    overall_quality: Literal['good', 'degraded', 'critical']
    warnings: list[str] = Field(default_factory=list)


class FieldSummary(CamelModel):
    total_wells: int = 10
    active_wells: int = 8
    total_oil_rate: float
    field_sor: float
    k_wh_per_bbl: float
    wells_at_risk: int
    steam_injected_today: float
    baseline_vs_twin_impact: dict[str, float]


class MetaInfo(CamelModel):
    application_version: str
    api_version: str = "v1"
    data_mode: DataMode = "simulated"
    simulation: bool = True
    field_validated: bool = False
    available_models: list[str] = Field(default_factory=list)
    model_status: dict[str, str] = Field(default_factory=dict)
    capabilities: list[str] = Field(default_factory=list)
    limitations: list[str] = Field(default_factory=list)
    assumptions_hash: str
    seed: int
    version: str


class FaultInjectionRequest(CamelModel):
    well_id: str
    fault_type: str
    sensor_tag: str | None = None
    tags: list[str] | None = None
    duration_sec: int | None = 300


class FaultInjectionResponse(CamelModel):
    status: str
    well_id: str
    fault_type: str
    tags: list[str] = Field(default_factory=list)
    duration_sec: int = 300


class AuditRecord(CamelModel):
    id: str
    well_id: str | None = None
    event_type: str
    details: dict[str, Any]
    created_at: str


class ComponentHealth(CamelModel):
    status: str
    details: dict[str, Any] | None = None


class HealthResponse(CamelModel):
    status: str
    service: str
    version: str
    timestamp: str = ""
    simulation: bool = True
    data_mode: str = "simulated"
    components: dict[str, ComponentHealth]

