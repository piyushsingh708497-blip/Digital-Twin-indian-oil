"""
OIL-TWIN AI - Joint Coupled Optimization Endpoint
GET /api/wells/{id}/joint
"""
from fastapi import APIRouter, HTTPException, Response

from app.connectors.simulated import default_data_source
from app.optimizer.joint_optimizer import JointOptimizer
from app.schemas.css import CssParams
from app.schemas.joint import JointResponse
from app.schemas.srp import SrpSetpoints
from app.twin.coupling import CoupledTwin
from app.twin.css_model import CssTwinModel
from app.twin.srp_model import SrpTwinModel

router = APIRouter(prefix="/api/wells", tags=["Joint Optimization"])

css_surrogate = CssTwinModel(n_monte_carlo=30, seed=42)
srp_surrogate = SrpTwinModel(seed=42)
coupled_twin = CoupledTwin(css_surrogate, srp_surrogate)
joint_optimizer = JointOptimizer(coupled_twin)


@router.get("/{id}/joint", response_model=JointResponse)
async def get_well_joint_optimization(id: str, response: Response):
    """
    Computes baselineSeparate (historical uncoupled practice) vs jointOptimized (coupled optimum)
    and constructs multi-objective Pareto front.
    """
    response.headers["X-Data-Mode"] = "simulated"

    try:
        state = await default_data_source.get_well_state(id)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Well '{id}' not found.")

    tel = state.telemetry

    curr_css = CssParams(
        steam_volume_tonnes=max(500.0, tel.css.cum_steam) if tel.css.cum_steam > 0 else 1800.0,
        inj_pressure=140.0,
        soak_days=tel.css.soak_day if tel.css.soak_day > 0 else 8.0,
        production_cutoff_water_cut=90.0,
    )
    curr_srp = SrpSetpoints(
        stroke_length=tel.srp.stroke_length if tel.srp.stroke_length > 0 else 2.8,
        spm=tel.srp.spm if tel.srp.spm > 0 else 4.5,
        vfd_hz=tel.srp.vfd_hz if tel.srp.vfd_hz > 0 else 45.0,
    )

    return joint_optimizer.optimize_well(
        well_id=id,
        current_css=curr_css,
        current_srp=curr_srp,
        current_res_temp_c=tel.reservoir.temperature,
    )
