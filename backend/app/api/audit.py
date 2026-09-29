"""
OIL-TWIN AI - Audit Trail API
GET /api/audit?wellId=&from=&to=
"""

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas.meta import AuditRecord
from app.services.audit import AuditService

router = APIRouter(prefix="/api/audit", tags=["Audit"])


@router.get("", response_model=list[AuditRecord])
async def get_audit_trail(
    response: Response,
    well_id: str | None = Query(None, alias="wellId"),
    from_ts: str | None = Query(None, alias="from"),
    to_ts: str | None = Query(None, alias="to"),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve immutable audit trail of human-in-the-loop decisions and system events."""
    response.headers["X-Data-Mode"] = "simulated"
    return await AuditService.get_audit_trail(
        session=db,
        well_id=well_id,
        from_ts=from_ts,
        to_ts=to_ts,
    )
