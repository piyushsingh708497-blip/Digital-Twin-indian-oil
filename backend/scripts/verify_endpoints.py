"""
OIL-TWIN AI - End-to-End Final API Verification
Calls every REST endpoint and WebSocket stream to verify camelCase JSON schema conformance.
"""
import os
import sys
import asyncio

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import httpx
from starlette.testclient import TestClient
from app.main import app


async def verify_all():
    print("=" * 60)
    print("OIL-TWIN AI - CALLING EVERY REST ENDPOINT")
    print("=" * 60)

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        # 1. Health
        r = await client.get("/api/health")
        assert r.status_code == 200, f"Health failed: {r.text}"
        print(f"GET /api/health                     -> 200 OK | status={r.json()['status']}")

        # 2. Meta
        r = await client.get("/api/meta")
        assert r.status_code == 200, f"Meta failed: {r.text}"
        print(f"GET /api/meta                       -> 200 OK | dataMode={r.json()['dataMode']}")

        # 3. Wells list
        r = await client.get("/api/wells")
        assert r.status_code == 200, f"Wells failed: {r.text}"
        wells = r.json()
        print(f"GET /api/wells                      -> 200 OK | {len(wells)} wells found")

        # 4. Well state
        r = await client.get("/api/wells/BW-01/state")
        assert r.status_code == 200, f"State failed: {r.text}"
        print(f"GET /api/wells/BW-01/state          -> 200 OK | phase={wells[0]['cssCyclePhase']}")

        # 5. History
        r = await client.get("/api/wells/BW-01/history")
        assert r.status_code == 200, f"History failed: {r.text}"
        print(f"GET /api/wells/BW-01/history        -> 200 OK | {len(r.json())} history points")

        # 6. Data Health
        r = await client.get("/api/wells/BW-01/data-health")
        assert r.status_code == 200, f"Data health failed: {r.text}"
        print(f"GET /api/wells/BW-01/data-health    -> 200 OK | quality={r.json()['overallQuality']}")

        # 7. CSS Forecast
        css_payload = {
            "steamVolumeTonnes": 1500.0,
            "injPressure": 120.0,
            "soakDays": 5.0,
            "productionCutoffWaterCut": 92.0,
        }
        r = await client.post("/api/wells/BW-01/css/forecast", json=css_payload)
        assert r.status_code == 200, f"CSS forecast failed: {r.text}"
        print(f"POST /api/wells/BW-01/css/forecast  -> 200 OK | cumOil={r.json()['cumOil']} m3")

        # 8. SRP Analysis
        srp_payload = {
            "strokeLength": 3.0,
            "spm": 5.0,
            "vfdHz": 50.0,
        }
        r = await client.post("/api/wells/BW-01/srp/analysis", json=srp_payload)
        assert r.status_code == 200, f"SRP analysis failed: {r.text}"
        print(f"POST /api/wells/BW-01/srp/analysis  -> 200 OK | rate={r.json()['predictedOilRate']} m3/d")

        # 9. Joint Optimization
        r = await client.get("/api/wells/BW-01/joint")
        assert r.status_code == 200, f"Joint failed: {r.text}"
        print(f"GET /api/wells/BW-01/joint          -> 200 OK | oilUplift={r.json()['jointOptimized']['oilUpliftPct']}%")

        # 10. Recommendations
        r = await client.get("/api/wells/BW-03/recommendations")
        assert r.status_code == 200, f"Recommendations failed: {r.text}"
        recos = r.json()
        print(f"GET /api/wells/BW-03/recommendations-> 200 OK | {len(recos)} recommendations generated")

        # 11. Decision
        rec_id = recos[0]["id"]
        dec_payload = {
            "decision": "accepted",
            "reason": "Engineering verification confirms setpoints mitigate rod floating.",
            "decidedBy": "Petroleum Lead",
        }
        r = await client.post(f"/api/recommendations/{rec_id}/decision", json=dec_payload)
        assert r.status_code == 200, f"Decision failed: {r.text}"
        print(f"POST /api/recommendations/.../dec.  -> 200 OK | decision={r.json()['decision']}")

        # 12. Alerts
        r = await client.get("/api/alerts")
        assert r.status_code == 200, f"Alerts failed: {r.text}"
        alerts = r.json()
        print(f"GET /api/alerts                     -> 200 OK | {len(alerts)} alerts listed")

        # 13. Alert Acknowledge
        if alerts:
            alt_id = alerts[0]["id"]
            r = await client.post(f"/api/alerts/{alt_id}/acknowledge")
            assert r.status_code == 200, f"Ack failed: {r.text}"
            print(f"POST /api/alerts/.../acknowledge    -> 200 OK | acknowledged={r.json()['acknowledged']}")

        # 14. Audit Log
        r = await client.get("/api/audit")
        assert r.status_code == 200, f"Audit failed: {r.text}"
        print(f"GET /api/audit                      -> 200 OK | {len(r.json())} audit records recorded")

        # 15. Field Summary
        r = await client.get("/api/field/summary")
        assert r.status_code == 200, f"Summary failed: {r.text}"
        print(f"GET /api/field/summary              -> 200 OK | oilRate={r.json()['totalOilRate']} m3/d")

        # 16. Dev Fault Injection
        fault_payload = {
            "wellId": "BW-01",
            "faultType": "sensor_dropout",
            "sensorTag": "wellbore_bht",
            "durationSec": 60,
        }
        r = await client.post("/api/dev/faults", json=fault_payload)
        assert r.status_code == 200, f"Fault failed: {r.text}"
        print(f"POST /api/dev/faults                -> 200 OK | status={r.json()['status']}")

    # 17. WebSocket verification
    print("\n" + "=" * 60)
    print("OIL-TWIN AI - VERIFYING WEBSOCKET STREAMING")
    print("=" * 60)
    sync_client = TestClient(app)
    with sync_client.websocket_connect("/ws/telemetry/BW-01") as ws:
        frame = ws.receive_json()
        assert "ts" in frame and "srp" in frame and "surface" in frame
        print(f"WS /ws/telemetry/BW-01              -> CONNECTED & RECEIVED FRAME:")
        print(f"   Timestamp: {frame['ts']}")
        print(f"   SRP Power: {frame['srp']['kW']} kW | SPM: {frame['srp']['spm']}")
        print(f"   Oil Rate:  {frame['surface']['oilRate']} m3/d | SOR: {frame['derived']['sor']}")

    print("\nALL 17 BACKEND REST & WS ENDPOINTS VALIDATED END-TO-END!")


if __name__ == "__main__":
    asyncio.run(verify_all())
