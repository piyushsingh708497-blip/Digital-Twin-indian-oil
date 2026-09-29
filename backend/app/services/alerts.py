"""
OIL-TWIN AI - Alert Dispatch and Acknowledgment Service
"""

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import AlertModel
from app.schemas.alerts import Alert


class AlertService:
    """Service managing active and historical alerts."""

    @staticmethod
    async def create_or_update_alert(session: AsyncSession, alert: Alert) -> AlertModel:
        """Saves an alert into the database."""
        stmt = select(AlertModel).where(AlertModel.id == alert.id)
        res = await session.execute(stmt)
        existing = res.scalar_one_or_none()

        if existing:
            existing.severity = alert.severity
            existing.probability = alert.probability
            existing.time_to_event_hrs = alert.time_to_event_hrs
            existing.message = alert.message
            await session.commit()
            return existing
        else:
            new_alert = AlertModel(
                id=alert.id,
                well_id=alert.well_id,
                severity=alert.severity,
                kind=alert.kind,
                probability=alert.probability,
                time_to_event_hrs=alert.time_to_event_hrs,
                message=alert.message,
                acknowledged=alert.acknowledged,
                created_at=alert.created_at,
            )
            session.add(new_alert)
            await session.commit()
            await session.refresh(new_alert)
            return new_alert

    @staticmethod
    async def get_alerts(
        session: AsyncSession,
        well_id: str | None = None,
        severity: str | None = None,
        acknowledged: bool | None = None,
    ) -> list[Alert]:
        """Fetches alerts with optional filtering."""
        stmt = select(AlertModel).order_by(AlertModel.created_at.desc())

        filters = []
        if well_id:
            filters.append(AlertModel.well_id == well_id)
        if severity:
            filters.append(AlertModel.severity == severity)
        if acknowledged is not None:
            filters.append(AlertModel.acknowledged == acknowledged)

        if filters:
            stmt = stmt.where(and_(*filters))

        result = await session.execute(stmt)
        rows = result.scalars().all()

        return [
            Alert(
                id=r.id,
                well_id=r.well_id,
                severity=r.severity,  # type: ignore
                kind=r.kind,          # type: ignore
                probability=r.probability,
                time_to_event_hrs=r.time_to_event_hrs,
                message=r.message,
                acknowledged=r.acknowledged,
                created_at=r.created_at,
            )
            for r in rows
        ]

    @staticmethod
    async def acknowledge_alert(session: AsyncSession, alert_id: str) -> Alert | None:
        """Marks an alert as acknowledged."""
        stmt = select(AlertModel).where(AlertModel.id == alert_id)
        res = await session.execute(stmt)
        alert = res.scalar_one_or_none()

        if not alert:
            return None

        alert.acknowledged = True
        await session.commit()
        await session.refresh(alert)

        return Alert(
            id=alert.id,
            well_id=alert.well_id,
            severity=alert.severity,  # type: ignore
            kind=alert.kind,          # type: ignore
            probability=alert.probability,
            time_to_event_hrs=alert.time_to_event_hrs,
            message=alert.message,
            acknowledged=alert.acknowledged,
            created_at=alert.created_at,
        )
