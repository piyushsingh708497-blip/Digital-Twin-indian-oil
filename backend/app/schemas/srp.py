"""
OIL-TWIN AI - SRP Schemas
Exact contract:
SrpSetpoints { strokeLength, spm, vfdHz }
SrpAnalysis { setpoints, predictedOilRate, rodStressPct, kW, failureRisk, dynoCard, warnings:string[] }
"""

from pydantic import Field

from app.schemas.common import CamelModel
from app.schemas.dyno import DynoCard


class SrpSetpoints(CamelModel):
    stroke_length: float = Field(..., ge=0.5, le=4.5, description="Stroke length in meters")
    spm: float = Field(..., ge=1.0, le=15.0, description="Strokes per minute")
    vfd_hz: float = Field(..., ge=10.0, le=70.0, description="VFD frequency in Hz")


class SrpAnalysis(CamelModel):
    setpoints: SrpSetpoints
    predicted_oil_rate: float
    rod_stress_pct: float
    k_w: float
    failure_risk: float
    dyno_card: DynoCard
    warnings: list[str] = Field(default_factory=list)
