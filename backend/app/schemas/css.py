"""
OIL-TWIN AI - CSS Schemas
Exact contract:
CssParams { steamVolumeTonnes, injPressure, soakDays, productionCutoffWaterCut }
CssForecast { params, oilRateCurve:[{day, p10, p50, p90}], cumOil, sor, energyCost, band:{p10,p50,p90} }
"""

from pydantic import Field

from app.schemas.common import CamelModel


class CssParams(CamelModel):
    steam_volume_tonnes: float = Field(..., ge=100.0, le=5000.0, description="Steam volume in tonnes")
    inj_pressure: float = Field(..., ge=10.0, le=250.0, description="Injection pressure in bar")
    soak_days: float = Field(..., ge=1.0, le=30.0, description="Soak time in days")
    production_cutoff_water_cut: float = Field(..., ge=50.0, le=99.0, description="Production cutoff water cut %")


class OilRateCurvePoint(CamelModel):
    day: int
    p10: float
    p50: float
    p90: float


class UncertaintyBand(CamelModel):
    p10: float
    p50: float
    p90: float


class CssForecast(CamelModel):
    params: CssParams
    oil_rate_curve: list[OilRateCurvePoint]
    cum_oil: float
    sor: float
    energy_cost: float
    band: UncertaintyBand
