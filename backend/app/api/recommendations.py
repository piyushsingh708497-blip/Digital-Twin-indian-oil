"""
OIL-TWIN AI - Recommendations & Decisions API
GET  /api/wells/{id}/recommendations
POST /api/recommendations/{id}/decision
"""
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.connectors.simulated import default_data_source
from app.db.models import DecisionModel, RecommendationModel
from app.db.session import get_db
from app.reco.engine import RecommendationEngine
from app.schemas.reco import Decision, DecisionRequest, Recommendation
from app.services.audit import AuditService
from app.twin.coupling import CoupledTwin
from app.twin.css_model import CssTwinModel
from app.twin.srp_model import SrpTwinModel

router = APIRouter(tags=["Recommendations"])

css_surrogate = CssTwinModel(n_monte_carlo=30, seed=42)
srp_surrogate = SrpTwinModel(seed=42)
coupled_twin = CoupledTwin(css_surrogate, srp_surrogate)
reco_engine = RecommendationEngine(coupled_twin)


@router.get("/api/wells/{id}/recommendations", response_model=list[Recommendation])
async def get_well_recommendations(id: str, response: Response, db: AsyncSession = Depends(get_db)):
    """Fetches advisory recommendations for a well with reasoning and SHAP drivers."""
    response.headers["X-Data-Mode"] = "simulated"

    try:
        state = await default_data_source.get_well_state(id)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Well '{id}' not found.")

    recos = reco_engine.generate_recommendations(state)

    # Cache/persist in DB
    for r in recos:
        stmt = select(RecommendationModel).where(RecommendationModel.id == r.id)
        res = await db.execute(stmt)
        existing = res.scalar_one_or_none()
        if not existing:
            rec_db = RecommendationModel(
                id=r.id,
                well_id=r.well_id,
                type=r.type,
                current_json=r.current,
                proposed_json=r.proposed,
                expected_gain_json=r.expected_gain.model_dump(by_alias=True),
                risk_score=r.risk_score,
                confidence=r.confidence,
                reasoning_json=r.reasoning,
                drivers_json=[d.model_dump(by_alias=True) for d in r.drivers],
                status=r.status,
                created_at=r.created_at,
            )
            db.add(rec_db)
    await db.commit()

    return recos


@router.post("/api/recommendations/{id}/decision", response_model=Decision)
async def submit_recommendation_decision(
    id: str,
    request: DecisionRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    """
    Submits human-in-the-loop decision (accepted, rejected, modified).
    Requires non-empty engineering rationale.
    Creates an immutable append-only audit log entry.
    """
    response.headers["X-Data-Mode"] = "simulated"

    # Mandatory reason check (already validated by Pydantic min_length=3, but double check)
    if not request.reason or not request.reason.strip():
        raise HTTPException(status_code=422, detail="Engineering reason is mandatory for any decision.")

    now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    decision_id = f"DEC-{uuid.uuid4().hex[:10].upper()}"

    # Update recommendation status in DB if exists
    stmt = select(RecommendationModel).where(RecommendationModel.id == id)
    res = await db.execute(stmt)
    rec = res.scalar_one_or_none()
    well_id = rec.well_id if rec else "UNKNOWN"

    if rec:
        rec.status = request.decision

    # Record Decision
    db_decision = DecisionModel(
        id=decision_id,
        recommendation_id=id,
        decision=request.decision,
        reason=request.reason,
        modified_values_json=request.modified_values,
        decided_by=request.decided_by,
        decided_at=now_iso,
    )
    db.add(db_decision)
    await db.commit()

    # Append to immutable Audit Trail
    await AuditService.log_event(
        session=db,
        event_type="RECOMMENDATION_DECISION",
        details={
            "decisionId": decision_id,
            "recommendationId": id,
            "decision": request.decision,
            "reason": request.reason,
            "modifiedValues": request.modified_values,
            "decidedBy": request.decided_by,
        },
        well_id=well_id,
    )

    return Decision(
        id=decision_id,
        recommendation_id=id,
        decision=request.decision,
        reason=request.reason,
        modified_values=request.modified_values,
        decided_by=request.decided_by,
        decided_at=now_iso,
    )
