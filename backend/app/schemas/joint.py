"""
OIL-TWIN AI - Joint Optimization Schemas
Exact contract:
GET /api/wells/{id}/joint -> {
  baselineSeparate,
  jointOptimized,
  pareto:[{oil, energy, risk, cssParams, srpSetpoints}]
}
"""
from app.schemas.common import CamelModel
from app.schemas.css import CssParams
from app.schemas.srp import SrpSetpoints


class JointBaseline(CamelModel):
    css_params: CssParams
    srp_setpoints: SrpSetpoints
    oil_rate: float
    sor: float
    k_wh_per_bbl: float
    rod_stress_pct: float
    failure_risk: float


class JointOptimized(CamelModel):
    css_params: CssParams
    srp_setpoints: SrpSetpoints
    oil_rate: float
    sor: float
    k_wh_per_bbl: float
    rod_stress_pct: float
    failure_risk: float
    oil_uplift_pct: float
    sor_reduction_pct: float
    energy_saving_pct: float


class ParetoPoint(CamelModel):
    oil: float
    energy: float
    risk: float
    css_params: CssParams
    srp_setpoints: SrpSetpoints


class JointResponse(CamelModel):
    baseline_separate: JointBaseline
    joint_optimized: JointOptimized
    pareto: list[ParetoPoint]
