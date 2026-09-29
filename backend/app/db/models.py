"""
OIL-TWIN AI - Declarative Database Models (SQLAlchemy 2.0)
Persists wells, recommendations, decisions, alerts, and append-only audit events.
"""
from datetime import datetime, timezone

from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    DateTime,
    Float,
    Integer,
    String,
    Text,
)

from app.db.session import Base


class WellModel(Base):
    __tablename__ = "wells"

    id = Column(String(32), primary_key=True, index=True)
    name = Column(String(64), nullable=False)
    status = Column(String(32), default="active")
    css_cycle_phase = Column(String(32), default="production")
    cycle_number = Column(Integer, default=1)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


class RecommendationModel(Base):
    __tablename__ = "recommendations"

    id = Column(String(64), primary_key=True, index=True)
    well_id = Column(String(32), nullable=False, index=True)
    type = Column(String(16), nullable=False)  # css, srp, joint
    current_json = Column(JSON, nullable=False)
    proposed_json = Column(JSON, nullable=False)
    expected_gain_json = Column(JSON, nullable=False)
    risk_score = Column(Float, nullable=False)
    confidence = Column(Float, nullable=False)
    reasoning_json = Column(JSON, nullable=False)
    drivers_json = Column(JSON, nullable=False)
    status = Column(String(16), default="pending", index=True)  # pending, accepted, rejected, modified
    created_at = Column(String(64), nullable=False)


class DecisionModel(Base):
    __tablename__ = "decisions"

    id = Column(String(64), primary_key=True, index=True)
    recommendation_id = Column(String(64), nullable=False, index=True)
    decision = Column(String(16), nullable=False)  # accepted, rejected, modified
    reason = Column(Text, nullable=False)          # Mandatory engineering rationale
    modified_values_json = Column(JSON, nullable=True)
    decided_by = Column(String(64), default="Engineer")
    decided_at = Column(String(64), nullable=False)


class AlertModel(Base):
    __tablename__ = "alerts"

    id = Column(String(64), primary_key=True, index=True)
    well_id = Column(String(32), nullable=False, index=True)
    severity = Column(String(16), nullable=False, index=True)  # info, warn, critical
    kind = Column(String(32), nullable=False)
    probability = Column(Float, nullable=False)
    time_to_event_hrs = Column(Float, nullable=True)
    message = Column(Text, nullable=False)
    acknowledged = Column(Boolean, default=False, index=True)
    created_at = Column(String(64), nullable=False)


class AuditEventModel(Base):
    __tablename__ = "audit_events"

    # Append-only ledger
    id = Column(String(64), primary_key=True, index=True)
    well_id = Column(String(32), nullable=True, index=True)
    event_type = Column(String(64), nullable=False, index=True)
    details_json = Column(JSON, nullable=False)
    created_at = Column(String(64), nullable=False, index=True)


class ScenarioModel(Base):
    __tablename__ = "scenarios"

    id = Column(String(64), primary_key=True, index=True)
    name = Column(String(128), nullable=False)
    description = Column(Text, nullable=True)
    config_json = Column(JSON, nullable=False)
    created_at = Column(String(64), nullable=False)
