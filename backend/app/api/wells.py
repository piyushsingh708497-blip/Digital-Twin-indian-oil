"""
OIL-TWIN AI - Wells and Telemetry Endpoints
GET /api/wells
GET /api/wells/{id}/state
GET /api/wells/{id}/history?from=&to=&step=
GET /api/wells/{id}/data-health
"""

from fastapi import APIRouter, HTTPException, Query, Response

from app.connectors.simulated import default_data_source
from app.schemas.meta import DataHealthResponse, WellStateResponse
from app.schemas.telemetry import Telemetry
from app.schemas.well import Well

router = APIRouter(prefix="/api/wells", tags=["Wells"])


@router.get("", response_model=list[Well])
async def list_wells(response: Response):
    """List all monitored wells in the field."""
    response.headers["X-Data-Mode"] = "simulated"
    return await default_data_source.get_wells()


@router.get("/{id}/state", response_model=WellStateResponse)
async def get_well_state(id: str, response: Response):
    """Fetch latest telemetry snapshot, dynamometer card, and active alerts for a well."""
    response.headers["X-Data-Mode"] = "simulated"
    try:
        return await default_data_source.get_well_state(id)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Well '{id}' not found.")


@router.get("/{id}/history", response_model=list[Telemetry])
async def get_well_history(
    id: str,
    response: Response,
    from_ts: str | None = Query(None, alias="from"),
    to_ts: str | None = Query(None, alias="to"),
    step: int | None = Query(None),
):
    """Fetch historical telemetry time-series for 24h-30d replay scrubber."""
    response.headers["X-Data-Mode"] = "simulated"
    history = await default_data_source.get_well_history(id, from_ts, to_ts, step)
    if not history and id not in [w.id for w in await default_data_source.get_wells()]:
        raise HTTPException(status_code=404, detail=f"Well '{id}' not found.")
    return history


@router.get("/{id}/data-health", response_model=DataHealthResponse)
async def get_well_data_health(id: str, response: Response):
    """Return tag diagnostics, staleness, and missing sensor analysis."""
    response.headers["X-Data-Mode"] = "simulated"
    try:
        return await default_data_source.get_data_health(id)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Well '{id}' not found.")
