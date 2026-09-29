"""
OIL-TWIN AI - Alerts API
GET  /api/alerts?wellId=&severity=&acknowledged=
POST /api/alerts/{id}/acknowledge
"""

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.connectors.simulated import default_data_source
from app.db.session import get_db
from app.schemas.alerts import Alert
from app.services.alerts import AlertService

router = APIRouter(prefix="/api/alerts", tags=["Alerts"])


@router.get("", response_model=list[Alert])
async def list_alerts(
    response: Response,
    well_id: str | None = Query(None, alias="wellId"),
    severity: str | None = Query(None),
    acknowledged: bool | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """Query field alerts with optional wellId, severity, and acknowledgment filters."""
    response.headers["X-Data-Mode"] = "simulated"

    # Sync live alerts from simulator into DB
    wells = await default_data_source.get_wells()
    for w in wells:
        state = await default_data_source.get_well_state(w.id)
        for a in state.active_alerts:
            await AlertService.create_or_update_alert(db, a)

    return await AlertService.get_alerts(
        session=db,
        well_id=well_id,
        severity=severity,
        acknowledged=acknowledged,
    )


@router.post("/{id}/acknowledge", response_model=Alert)
async def acknowledge_alert(id: str, response: Response, db: AsyncSession = Depends(get_db)):
    """Acknowledge an active or historical alert."""
    response.headers["X-Data-Mode"] = "simulated"
    alert = await AlertService.acknowledge_alert(db, id)
    if not alert:
        raise HTTPException(status_code=404, detail=f"Alert '{id}' not found.")
    return alert
