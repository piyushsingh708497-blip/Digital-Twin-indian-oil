"""
OIL-TWIN AI - Telemetry Schema
Exact contract:
Telemetry {
  ts,
  reservoir:{pressure, temperature},
  wellbore:{bhp, bht, fluidLevel, steamQuality},
  css:{steamRate, injPressure, cumSteam, soakDay},
  srp:{strokeLength, spm, vfdHz, rodLoadMax, rodLoadMin, motorAmps, kW, pumpFillagePct},
  surface:{wellheadPressure, wellheadTemp, flowRate, waterCutPct, oilRate},
  derived:{sor, kWhPerBbl},
  quality:{tagStatus: Record<tag,'ok'|'stale'|'bad'|'missing'>, dataAgeSec}
}
"""

from app.schemas.common import CamelModel, TagQualityStatus


class ReservoirTelemetry(CamelModel):
    pressure: float
    temperature: float


class WellboreTelemetry(CamelModel):
    bhp: float
    bht: float
    fluid_level: float
    steam_quality: float


class CssTelemetry(CamelModel):
    steam_rate: float
    inj_pressure: float
    cum_steam: float
    soak_day: float


class SrpTelemetry(CamelModel):
    stroke_length: float
    spm: float
    vfd_hz: float
    rod_load_max: float
    rod_load_min: float
    motor_amps: float
    k_w: float
    pump_fillage_pct: float


class SurfaceTelemetry(CamelModel):
    wellhead_pressure: float
    wellhead_temp: float
    flow_rate: float
    water_cut_pct: float
    oil_rate: float


class DerivedTelemetry(CamelModel):
    sor: float | None = None
    k_wh_per_bbl: float | None = None


class QualityTelemetry(CamelModel):
    tag_status: dict[str, TagQualityStatus]
    data_age_sec: float


class Telemetry(CamelModel):
    ts: str
    reservoir: ReservoirTelemetry
    wellbore: WellboreTelemetry
    css: CssTelemetry
    srp: SrpTelemetry
    surface: SurfaceTelemetry
    derived: DerivedTelemetry
    quality: QualityTelemetry
