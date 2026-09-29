"""
OIL-TWIN AI - Development & Testing Fault Injection API
POST /api/dev/faults
Disabled when ENV=production.
"""
from fastapi import APIRouter, HTTPException, Response

from app.config.settings import settings
from app.connectors.simulated import default_data_source
from app.schemas.meta import FaultInjectionRequest, FaultInjectionResponse

router = APIRouter(prefix="/api/dev", tags=["Development Faults"])


@router.post("/faults", response_model=FaultInjectionResponse)
async def inject_fault(request: FaultInjectionRequest, response: Response):
    """
    Injects synthetic sensor faults, stale tags, or communication loss into a well.
    Allows live verification of graceful degradation.
    Disabled in production mode.
    """
    if settings.ENV == "production":
        raise HTTPException(status_code=403, detail="Fault injection endpoint is disabled in production.")

    response.headers["X-Data-Mode"] = "simulated"
    res = await default_data_source.inject_fault(request)
    return FaultInjectionResponse(
        status=res.get("status", "injected"),
        well_id=request.well_id,
        fault_type=request.fault_type,
        tags=res.get("tags", []),
        duration_sec=res.get("duration_sec", request.duration_sec or 300),
    )
