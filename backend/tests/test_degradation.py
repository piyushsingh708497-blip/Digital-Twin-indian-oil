"""
OIL-TWIN AI - Data Health and Degradation Tests
Verifies:
1. Sensor dropout fault injection via POST /api/dev/faults
2. GET /api/wells/{id}/data-health identifies degraded tags and issues warnings
3. API never produces HTTP 500 when simulated sensors are degraded
4. Telemetry quality flags reflect 'bad' or 'uncertain' for dropped tags
5. No fake values invented; derived metrics null when required inputs missing
"""
import httpx
import pytest

from app.main import app


@pytest.mark.asyncio
async def test_sensor_dropout_degrades_gracefully():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as ac:
        # 1. Inject sensor dropout fault on Well BW-05 for wellhead pressure
        fault_payload = {
            "wellId": "BW-05",
            "faultType": "sensor_dropout",
            "sensorTag": "wellbore_bht",
            "durationSec": 120,
        }
        fault_resp = await ac.post("/api/dev/faults", json=fault_payload)
        assert fault_resp.status_code == 200

        # 2. Check data health endpoint
        health_resp = await ac.get("/api/wells/BW-05/data-health")
        assert health_resp.status_code == 200
        health_data = health_resp.json()
        assert health_data["wellId"] == "BW-05"
        assert health_data["healthy"] is False
        assert health_data["tagStatus"]["wellbore_bht"] == "bad"
        assert len(health_data["warnings"]) > 0

        # 3. Check well state endpoint - MUST NOT return HTTP 500
        state_resp = await ac.get("/api/wells/BW-05/state")
        assert state_resp.status_code == 200
        state_data = state_resp.json()
        assert state_data["telemetry"]["quality"]["tagStatus"]["wellbore_bht"] == "bad"


@pytest.mark.asyncio
async def test_stale_telemetry_detection():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as ac:
        # Inject stale telemetry fault on BW-02
        fault_payload = {
            "wellId": "BW-02",
            "faultType": "stale_telemetry",
            "durationSec": 120,
        }
        fault_resp = await ac.post("/api/dev/faults", json=fault_payload)
        assert fault_resp.status_code == 200

        health_resp = await ac.get("/api/wells/BW-02/data-health")
        assert health_resp.status_code == 200
        health_data = health_resp.json()
        assert health_data["healthy"] is False
        assert any("stale" in w.lower() for w in health_data["warnings"])


@pytest.mark.asyncio
async def test_null_derived_metrics_when_oil_is_zero():
    """Verify SOR and kWhPerBbl are null (not clamped, not 10.0, not NaN) during zero oil rate."""
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as ac:
        # Well BW-04 is in injection phase, zero oil production
        state_resp = await ac.get("/api/wells/BW-04/state")
        assert state_resp.status_code == 200
        data = state_resp.json()
        tel = data["telemetry"]
        # In injection/soak, oil rate is 0
        if tel["surface"]["oilRate"] == 0:
            assert tel["derived"]["sor"] is None
            assert tel["derived"]["kWhPerBbl"] is None
