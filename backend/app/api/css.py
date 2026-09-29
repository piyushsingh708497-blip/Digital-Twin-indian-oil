"""
OIL-TWIN AI - CSS Forecasting Endpoint
POST /api/wells/{id}/css/forecast
"""
from fastapi import APIRouter, HTTPException, Response

from app.connectors.simulated import default_data_source
from app.schemas.css import CssForecast, CssParams
from app.twin.css_model import CssTwinModel

router = APIRouter(prefix="/api/wells", tags=["CSS"])

css_model = CssTwinModel(n_monte_carlo=50, seed=42)


@router.post("/{id}/css/forecast", response_model=CssForecast)
async def forecast_css(id: str, params: CssParams, response: Response):
    """Computes fast forward CSS production curve with Monte Carlo uncertainty (<200 ms)."""
    response.headers["X-Data-Mode"] = "simulated"

    try:
        state = await default_data_source.get_well_state(id)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Well '{id}' not found.")

    res_temp = state.telemetry.reservoir.temperature
    res_p = state.telemetry.reservoir.pressure

    forecast, _ = css_model.forecast(
        params=params,
        current_res_temp_c=res_temp,
        current_res_pressure_bar=res_p,
    )
    return forecast
