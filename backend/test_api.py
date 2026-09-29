"""
OIL-TWIN AI - Extended API Tests
Tests all critical endpoints including optimization and predictions
"""
import json
import time
import urllib.request

BASE = "http://localhost:8000/api"

def post(path, body):
    data = json.dumps(body).encode()
    req = urllib.request.Request(
        BASE + path, data=data,
        headers={"Content-Type": "application/json"}
    )
    return json.loads(urllib.request.urlopen(req).read())

def get(path):
    return json.loads(urllib.request.urlopen(BASE + path).read())

print("=" * 50)
print("OIL-TWIN AI - Full API Test Suite")
print("=" * 50)

# 1. Health
h = get("/health")
assert h["status"] == "ok", f"Health failed: {h}"
print("[PASS] GET /api/health")

# 2. Wells
wells = get("/wells")
assert len(wells) == 5, f"Expected 5 wells, got {len(wells)}"
print(f"[PASS] GET /api/wells — {len(wells)} wells")

# 3. Single well
w = get("/wells/BAGH-001")
assert w["well_id"] == "BAGH-001"
print(f"[PASS] GET /api/wells/BAGH-001 — {w['health_status']}")

# 4. Telemetry
tel = get("/wells/BAGH-001/telemetry")
assert len(tel) > 0
print(f"[PASS] GET /api/wells/BAGH-001/telemetry — {len(tel)} points")

# 5. Dashboard
d = get("/dashboard/BAGH-001")
assert "latest_telemetry" in d
assert len(d["production_trend"]) > 0
print(f"[PASS] GET /api/dashboard/BAGH-001 — oil={d['latest_telemetry']['oil_rate_m3d']} m3/d")

# 6. CSS Simulate
css = post("/css/simulate", {
    "well_id": "BAGH-001",
    "steam_volume_m3": 1200,
    "injection_pressure_kpa": 5500,
    "soak_time_days": 10,
    "production_cutoff_m3d": 1.0,
    "cycle_number": 6,
    "current_reservoir_temp_c": 52.0,
    "current_viscosity_cp": 18000.0
})
assert "predicted_oil_m3" in css
print(f"[PASS] POST /api/css/simulate — {css['predicted_oil_m3']:.1f} m3, SOR={css['sor']:.2f}")

# 7. SRP Simulate
srp = post("/srp/simulate", {
    "well_id": "BAGH-001",
    "stroke_length_m": 3.5,
    "spm": 8.0,
    "vfd_hz": 50.0,
    "reservoir_temp_c": 95.0,
    "reservoir_pressure_kpa": 4500.0,
    "viscosity_cp": 5000.0
})
assert "predicted_rate_m3d" in srp
print(f"[PASS] POST /api/srp/simulate — rate={srp['predicted_rate_m3d']:.2f} m3/d, eff={srp['pump_efficiency_pct']:.1f}%")

# 8. What-If Simulation
sim = post("/simulation/run", {
    "well_id": "BAGH-001",
    "scenario_name": "Scenario A",
    "steam_volume_m3": 1500,
    "injection_pressure_kpa": 6000,
    "soak_time_days": 12,
    "production_cutoff_m3d": 1.0,
    "stroke_length_m": 3.5,
    "spm": 9.0,
    "vfd_hz": 50.0,
    "current_reservoir_temp_c": 52.0,
    "current_viscosity_cp": 18000.0,
    "current_reservoir_pressure_kpa": 4500.0,
    "cycle_number": 6
})
assert "overall_score" in sim
print(f"[PASS] POST /api/simulation/run — score={sim['overall_score']:.4f}, risk={sim['overall_risk']:.1f}")

# 9. Optimization (takes a bit longer)
print("Testing /api/optimization/run (720 scenarios — may take 10-20s)...")
t0 = time.time()
opt = post("/optimization/run", {
    "well_id": "BAGH-001",
    "current_reservoir_temp_c": 52.0,
    "current_viscosity_cp": 18000.0,
    "current_reservoir_pressure_kpa": 4500.0,
    "cycle_number": 6,
    "weight_production": 0.35,
    "weight_efficiency": 0.20,
    "weight_energy": 0.20,
    "weight_sor": 0.15,
    "weight_risk": 0.10
})
elapsed = time.time() - t0
assert "best_scenario" in opt
assert "explanation" in opt
print(f"[PASS] POST /api/optimization/run — best_score={opt['optimization_score']:.4f}, took {elapsed:.1f}s")
print(f"       Best: production={opt['best_scenario']['oil_production_m3']:.1f} m3, SOR={opt['best_scenario']['sor']:.2f}")

# 10. Predict Production
pred = post("/predict/production", {
    "reservoir_temp_c": 95.0,
    "reservoir_pressure_kpa": 4500.0,
    "viscosity_cp": 3500.0,
    "steam_volume_m3": 1200.0,
    "injection_pressure_kpa": 5500.0,
    "soak_time_days": 10.0,
    "stroke_length_m": 3.5,
    "spm": 8.0,
    "vfd_hz": 50.0,
    "css_cycle_number": 6
})
assert "predicted_value" in pred
print(f"[PASS] POST /api/predict/production — {pred['predicted_value']:.2f} m3/d, conf={pred['confidence']:.1f}%")

# 11. Predict Risk
risk = post("/predict/risk", {
    "viscosity_cp": 5000.0,
    "reservoir_temp_c": 95.0,
    "reservoir_pressure_kpa": 4500.0,
    "spm": 8.0,
    "stroke_length_m": 3.5,
    "vfd_hz": 50.0,
    "pump_efficiency_pct": 72.0,
    "oil_rate_m3d": 10.0
})
assert "rod_floating_risk" in risk
print(f"[PASS] POST /api/predict/risk — overall={risk['overall_risk']:.1f}, severity={risk['severity']}")

# 12. Alerts
alerts = get("/alerts")
assert isinstance(alerts, list)
print(f"[PASS] GET /api/alerts — {len(alerts)} alerts")

# 13. Report
rep = get("/reports/BAGH-001")
assert rep["well_id"] == "BAGH-001"
assert "equipment_risk" in rep
print(f"[PASS] GET /api/reports/BAGH-001 — risk={rep['equipment_risk']['overall_risk']:.1f}")

print()
print("=" * 50)
print("ALL 13 API TESTS PASSED")
print("Backend is fully functional and ready for demo.")
print("=" * 50)
