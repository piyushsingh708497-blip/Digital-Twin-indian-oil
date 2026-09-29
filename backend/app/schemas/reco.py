"""
OIL-TWIN AI - Recommendation & Decision Schemas
Exact contract:
Recommendation {
  id, wellId, type:'css'|'srp'|'joint', current, proposed,
  expectedGain:{oilBblPerDay, sorDelta, kWhDelta},
  riskScore, confidence, reasoning:string[], drivers:[{feature, contribution}],
  status:'pending'|'accepted'|'rejected'|'modified', createdAt
}
Decision {
  id, recommendationId, decision:'accepted'|'rejected'|'modified',
  reason, modifiedValues?, decidedBy, decidedAt
}
"""
from typing import Any

from pydantic import Field, field_validator

from app.schemas.common import CamelModel, DecisionType, RecoStatus, RecoType


class ExpectedGain(CamelModel):
    oil_bbl_per_day: float
    sor_delta: float
    k_wh_delta: float


class RecoDriver(CamelModel):
    feature: str
    contribution: float


class Recommendation(CamelModel):
    id: str
    well_id: str
    type: RecoType
    current: dict[str, Any]
    proposed: dict[str, Any]
    expected_gain: ExpectedGain
    risk_score: float
    confidence: float
    reasoning: list[str]
    drivers: list[RecoDriver]
    status: RecoStatus = "pending"
    created_at: str


class DecisionRequest(CamelModel):
    decision: DecisionType
    reason: str = Field(..., min_length=3, description="Mandatory engineering rationale for decision")
    modified_values: dict[str, Any] | None = None
    decided_by: str = "Production Engineer"

    @field_validator("reason")
    @classmethod
    def validate_reason_non_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Reason cannot be empty or blank")
        return v.strip()


class Decision(CamelModel):
    id: str
    recommendation_id: str
    decision: DecisionType
    reason: str
    modified_values: dict[str, Any] | None = None
    decided_by: str
    decided_at: str
