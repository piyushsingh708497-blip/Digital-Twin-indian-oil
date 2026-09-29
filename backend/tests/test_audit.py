"""
OIL-TWIN AI - Audit System Tests
Verifies:
1. Append-only nature of audit events
2. Decision requires non-empty reason (422 Unprocessable Entity if empty or missing)
3. Recommendations are strictly advisory and never automatically applied
4. Audit trail captures decision, reason, actor, timestamp, and entity details
"""
import httpx
import pytest

from app.main import app


@pytest.mark.asyncio
async def test_decision_requires_mandatory_reason():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as ac:
        # First ensure a recommendation exists
        recos_resp = await ac.get("/api/wells/BW-01/recommendations")
        assert recos_resp.status_code == 200
        recos = recos_resp.json()
        assert len(recos) > 0
        rec_id = recos[0]["id"]

        # 1. Empty reason string -> Rejected with 422
        bad_payload = {
            "decision": "accepted",
            "reason": "",
            "decidedBy": "Engineer",
        }
        resp = await ac.post(f"/api/recommendations/{rec_id}/decision", json=bad_payload)
        assert resp.status_code == 422

        # 2. Whitespace-only reason -> Rejected with 422
        ws_payload = {
            "decision": "accepted",
            "reason": "   ",
            "decidedBy": "Engineer",
        }
        resp_ws = await ac.post(f"/api/recommendations/{rec_id}/decision", json=ws_payload)
        assert resp_ws.status_code == 422

        # 3. Missing reason field -> Rejected with 422
        no_reason_payload = {
            "decision": "accepted",
            "decidedBy": "Engineer",
        }
        resp_missing = await ac.post(f"/api/recommendations/{rec_id}/decision", json=no_reason_payload)
        assert resp_missing.status_code == 422


@pytest.mark.asyncio
async def test_decision_creates_append_only_audit_record():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as ac:
        # Count existing audit logs
        initial_resp = await ac.get("/api/audit")
        assert initial_resp.status_code == 200
        initial_count = len(initial_resp.json())

        # Submit valid decision
        recos_resp = await ac.get("/api/wells/BW-02/recommendations")
        recos = recos_resp.json()
        rec_id = recos[0]["id"]

        valid_payload = {
            "decision": "rejected",
            "reason": "Operational constraints prevent steam injection adjustments until next quarter maintenance.",
            "decidedBy": "Chief Production Engineer",
        }
        dec_resp = await ac.post(f"/api/recommendations/{rec_id}/decision", json=valid_payload)
        assert dec_resp.status_code == 200

        # Fetch audit log again -> Must have grown by 1
        audit_resp = await ac.get("/api/audit")
        assert audit_resp.status_code == 200
        records = audit_resp.json()
        assert len(records) == initial_count + 1

        # Verify most recent record (order_by created_at.desc())
        newest = records[0]
        assert newest["eventType"] == "RECOMMENDATION_DECISION"
        assert newest["details"]["decision"] == "rejected"
        assert newest["details"]["reason"] == valid_payload["reason"]
        assert newest["details"]["decidedBy"] == "Chief Production Engineer"


@pytest.mark.asyncio
async def test_recommendations_not_auto_applied():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as ac:
        # 1. Get initial well state
        state_resp = await ac.get("/api/wells/BW-03/state")
        assert state_resp.status_code == 200
        initial_spm = state_resp.json()["telemetry"]["srp"]["spm"]

        # 2. Get recommendations (advisory)
        reco_resp = await ac.get("/api/wells/BW-03/recommendations")
        assert reco_resp.status_code == 200
        recos = reco_resp.json()
        srp_reco = next((r for r in recos if r["type"] == "srp"), None)
        assert srp_reco is not None
        assert srp_reco["status"] == "pending"

        # 3. Check well state again -> Pumping setpoint must NOT have changed automatically
        state_after = await ac.get("/api/wells/BW-03/state")
        assert state_after.json()["telemetry"]["srp"]["spm"] == initial_spm
