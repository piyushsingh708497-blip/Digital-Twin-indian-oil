"""
OIL-TWIN AI - Alert Schema
Exact contract:
Alert {
  id, wellId, severity:'info'|'warn'|'critical',
  kind:'rod_failure_risk'|'rod_floating'|'impact_loading'|'pump_unsetting'|'high_sor'|'sensor_fault'|'data_stale',
  probability, timeToEventHrs, message, acknowledged, createdAt
}
"""

from app.schemas.common import AlertKind, AlertSeverity, CamelModel


class Alert(CamelModel):
    id: str
    well_id: str
    severity: AlertSeverity
    kind: AlertKind
    probability: float
    time_to_event_hrs: float | None = None
    message: str
    acknowledged: bool = False
    created_at: str
