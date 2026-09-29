"""
OIL-TWIN AI - Integration Tests for All API Endpoints
Verifies:
1. GET /api/wells
2. GET /api/wells/{id}/state
3. GET /api/wells/{id}/history?from=&to=&step=
4. POST /api/wells/{id}/css/forecast
5. POST /api/wells/{id}/srp/analysis
6. GET /api/wells/{id}/joint
7. GET /api/wells/{id}/recommendations
8. POST /api/recommendations/{id}/decision
9. GET /api/alerts
10. POST /api/alerts/{id}/acknowledge
11. GET /api/audit
12. GET /api/wells/{id}/data-health
13. GET /api/field/summary
14. GET /api/meta
15. POST /api/dev/faults
16. GET /api/health
17. WS /ws/telemetry/{id}
18. CamelCase contract compliance on all JSON responses
"""
import httpx
import pytest
from starlette.testclient import TestClient

from app.main import app


@pytest.fixture
def client():
    return TestClient(app)


@pytest.mark.asyncio
async def test_health_endpoint():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as ac:
        resp = await ac.get("/api/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"
        assert "timestamp" in data
        assert "version" in data
        assert data["simulation"] is True


@pytest.mark.asyncio
async def test_meta_endpoint():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as ac:
        resp = await ac.get("/api/meta")
        assert resp.status_code == 200
        data = resp.json()
        # Verify contract fields
        assert data["dataMode"] == "simulated"
        assert data["fieldValidated"] is False
        assert "assumptionsHash" in data
        assert "capabilities" in data
        assert "limitations" in data
        assert "availableModels" in data
        # Response headers check
        assert resp.headers.get("x-data-mode") == "simulated"


@pytest.mark.asyncio
async def test_wells_list():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as ac:
        resp = await ac.get("/api/wells")
        assert resp.status_code == 200
        wells = resp.json()
        assert len(wells) >= 8
        w0 = wells[0]
        # Contract camelCase validation
        assert "id" in w0
        assert "name" in w0
        assert "status" in w0
        assert "cssCyclePhase" in w0
        assert "cycleNumber" in w0
        assert w0["id"].startswith("BW-")


@pytest.mark.asyncio
async def test_well_state():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as ac:
        resp = await ac.get("/api/wells/BW-01/state")
        assert resp.status_code == 200
        data = resp.json()
        assert "telemetry" in data
        assert "dynoCard" in data
        assert "activeAlerts" in data

        tel = data["telemetry"]
        assert "reservoir" in tel
        assert "wellbore" in tel
        assert "css" in tel
        assert "srp" in tel
        assert "surface" in tel
        assert "derived" in tel
        assert "quality" in tel

        # Check camelCase fields inside srp and surface
        assert "strokeLength" in tel["srp"]
        assert "kW" in tel["srp"]
        assert "oilRate" in tel["surface"]
        assert "waterCutPct" in tel["surface"]
        assert "kWhPerBbl" in tel["derived"]

        # Check dyno card
        dyno = data["dynoCard"]
        assert "surface" in dyno
        assert "downhole" in dyno
        assert "diagnosis" in dyno
        assert "confidence" in dyno


@pytest.mark.asyncio
async def test_well_history():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as ac:
        resp = await ac.get("/api/wells/BW-01/history")
        assert resp.status_code == 200
        hist = resp.json()
        assert len(hist) > 0
        assert "ts" in hist[0]
        assert "surface" in hist[0]


@pytest.mark.asyncio
async def test_css_forecast_endpoint():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as ac:
        payload = {
            "steamVolumeTonnes": 1400.0,
            "injPressure": 135.0,
            "soakDays": 6.0,
            "productionCutoffWaterCut": 90.0,
        }
        resp = await ac.post("/api/wells/BW-01/css/forecast", json=payload)
        assert resp.status_code == 200
        data = resp.json()
        assert "params" in data
        assert "oilRateCurve" in data
        assert "cumOil" in data
        assert "sor" in data
        assert "energyCost" in data
        assert "band" in data
        assert len(data["oilRateCurve"]) > 0
        assert data["cumOil"] > 0
        assert data["sor"] > 0


@pytest.mark.asyncio
async def test_srp_analysis_endpoint():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as ac:
        payload = {
            "strokeLength": 3.0,
            "spm": 5.5,
            "vfdHz": 50.0,
        }
        resp = await ac.post("/api/wells/BW-01/srp/analysis", json=payload)
        assert resp.status_code == 200
        data = resp.json()
        assert "setpoints" in data
        assert "predictedOilRate" in data
        assert "rodStressPct" in data
        assert "kW" in data
        assert "failureRisk" in data
        assert "dynoCard" in data


@pytest.mark.asyncio
async def test_joint_optimization_endpoint():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as ac:
        resp = await ac.get("/api/wells/BW-01/joint")
        assert resp.status_code == 200
        data = resp.json()
        assert "baselineSeparate" in data
        assert "jointOptimized" in data
        assert "pareto" in data
        assert "oilUpliftPct" in data["jointOptimized"]
        assert "sorReductionPct" in data["jointOptimized"]
        assert "energySavingPct" in data["jointOptimized"]


@pytest.mark.asyncio
async def test_recommendations_and_decision():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as ac:
        # 1. Fetch recommendations
        resp = await ac.get("/api/wells/BW-03/recommendations")
        assert resp.status_code == 200
        recos = resp.json()
        assert len(recos) > 0
        r0 = recos[0]
        assert "id" in r0
        assert "wellId" in r0
        assert "type" in r0
        assert "current" in r0
        assert "proposed" in r0
        assert "expectedGain" in r0
        assert "riskScore" in r0
        assert "confidence" in r0
        assert "reasoning" in r0
        assert "drivers" in r0
        assert "status" in r0

        # 2. Submit human decision with valid reason
        rec_id = r0["id"]
        dec_payload = {
            "decision": "accepted",
            "reason": "Engineering review confirmed rod floating mitigation is sound.",
            "decidedBy": "Petroleum Engineer",
        }
        dec_resp = await ac.post(f"/api/recommendations/{rec_id}/decision", json=dec_payload)
        assert dec_resp.status_code == 200
        dec_data = dec_resp.json()
        assert dec_data["recommendationId"] == rec_id
        assert dec_data["decision"] == "accepted"
        assert dec_data["reason"] == dec_payload["reason"]
        assert "decidedAt" in dec_data


@pytest.mark.asyncio
async def test_alerts_and_acknowledge():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as ac:
        # 1. List alerts
        resp = await ac.get("/api/alerts")
        assert resp.status_code == 200
        alerts = resp.json()
        assert isinstance(alerts, list)

        if alerts:
            alt_id = alerts[0]["id"]
            # 2. Acknowledge alert
            ack_resp = await ac.post(f"/api/alerts/{alt_id}/acknowledge")
            assert ack_resp.status_code == 200
            ack_data = ack_resp.json()
            assert ack_data["acknowledged"] is True


@pytest.mark.asyncio
async def test_audit_log():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as ac:
        resp = await ac.get("/api/audit")
        assert resp.status_code == 200
        records = resp.json()
        assert isinstance(records, list)
        if records:
            r = records[0]
            assert "id" in r
            assert "eventType" in r
            assert "details" in r
            assert "createdAt" in r


@pytest.mark.asyncio
async def test_data_health():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as ac:
        resp = await ac.get("/api/wells/BW-01/data-health")
        assert resp.status_code == 200
        data = resp.json()
        assert "wellId" in data
        assert "healthy" in data
        assert "tagStatus" in data
        assert "dataAgeSec" in data
        assert "warnings" in data


@pytest.mark.asyncio
async def test_field_summary():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as ac:
        resp = await ac.get("/api/field/summary")
        assert resp.status_code == 200
        data = resp.json()
        assert "totalWells" in data
        assert "activeWells" in data
        assert "totalOilRate" in data
        assert "fieldSor" in data
        assert "kWhPerBbl" in data
        assert "wellsAtRisk" in data
        assert "baselineVsTwinImpact" in data


@pytest.mark.asyncio
async def test_dev_fault_injection():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as ac:
        payload = {
            "wellId": "BW-01",
            "faultType": "sensor_dropout",
            "sensorTag": "surface_water_cut",
            "durationSec": 60,
        }
        resp = await ac.post("/api/dev/faults", json=payload)
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "injected"
        assert data["wellId"] == "BW-01"
        assert data["faultType"] == "sensor_dropout"


def test_websocket_telemetry_stream(client):
    """Verifies that WebSocket connects, streams valid Telemetry matching schema, and disconnects cleanly."""
    with client.websocket_connect("/ws/telemetry/BW-01") as websocket:
        # Read first live frame
        frame = websocket.receive_json()
        assert "ts" in frame
        assert "reservoir" in frame
        assert "wellbore" in frame
        assert "css" in frame
        assert "srp" in frame
        assert "surface" in frame
        assert "derived" in frame
        assert "quality" in frame
        # Check camelCase contract
        assert "kW" in frame["srp"]
        assert "kWhPerBbl" in frame["derived"]
        assert "oilRate" in frame["surface"]
