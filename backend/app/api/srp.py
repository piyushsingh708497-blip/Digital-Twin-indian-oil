"""
OIL-TWIN AI - SRP Analysis Endpoint
POST /api/wells/{id}/srp/analysis
"""
from fastapi import APIRouter, HTTPException, Response

from app.connectors.simulated import default_data_source
from app.schemas.srp import SrpAnalysis, SrpSetpoints
from app.simulator.reservoir import compute_oil_viscosity_cp
from app.twin.srp_model import SrpTwinModel

router = APIRouter(prefix="/api/wells", tags=["SRP"])

srp_model = SrpTwinModel(seed=42)


@router.post("/{id}/srp/analysis", response_model=SrpAnalysis)
async def analyze_srp(id: str, setpoints: SrpSetpoints, response: Response):
    """Evaluates SRP setpoints for mechanical integrity, power, and dyno card (<200 ms)."""
    response.headers["X-Data-Mode"] = "simulated"

    try:
        state = await default_data_source.get_well_state(id)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Well '{id}' not found.")

    bht = state.telemetry.wellbore.bht
    viscosity = compute_oil_viscosity_cp(bht)
    fluid_lvl = state.telemetry.wellbore.fluid_level

    analysis, _ = srp_model.analyze(
        setpoints=setpoints,
        viscosity_cp=viscosity,
        fluid_level_m=fluid_lvl,
        inflow_liquid_bbl_day=max(30.0, state.telemetry.surface.flow_rate),
        water_cut_pct=state.telemetry.surface.water_cut_pct,
    )
    return analysis
