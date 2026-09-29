"""
OIL-TWIN AI - Append-Only Audit Logging Service
Ensures immutable recording of human-in-the-loop decisions and system events.
"""
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import AuditEventModel
from app.schemas.meta import AuditRecord


class AuditService:
    """Service managing append-only operational audit trail."""

    @staticmethod
    async def log_event(
        session: AsyncSession,
        event_type: str,
        details: dict[str, Any],
        well_id: str | None = None,
    ) -> AuditRecord:
        """Appends a new immutable audit record to the ledger."""
        record_id = f"AUD-{uuid.uuid4().hex[:12].upper()}"
        now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

        db_event = AuditEventModel(
            id=record_id,
            well_id=well_id,
            event_type=event_type,
            details_json=details,
            created_at=now_iso,
        )
        session.add(db_event)
        await session.commit()
        await session.refresh(db_event)

        return AuditRecord(
            id=db_event.id,
            well_id=db_event.well_id,
            event_type=db_event.event_type,
            details=db_event.details_json,
            created_at=db_event.created_at,
        )

    @staticmethod
    async def get_audit_trail(
        session: AsyncSession,
        well_id: str | None = None,
        from_ts: str | None = None,
        to_ts: str | None = None,
    ) -> list[AuditRecord]:
        """Queries historical audit entries with optional filtering."""
        stmt = select(AuditEventModel).order_by(AuditEventModel.created_at.desc())

        filters = []
        if well_id:
            filters.append(AuditEventModel.well_id == well_id)
        if from_ts:
            filters.append(AuditEventModel.created_at >= from_ts)
        if to_ts:
            filters.append(AuditEventModel.created_at <= to_ts)

        if filters:
            stmt = stmt.where(and_(*filters))

        result = await session.execute(stmt)
        rows = result.scalars().all()

        return [
            AuditRecord(
                id=r.id,
                well_id=r.well_id,
                event_type=r.event_type,
                details=r.details_json,
                created_at=r.created_at,
            )
            for r in rows
        ]
