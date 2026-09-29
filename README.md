# OIL-TWIN AI — Well-to-Surface Digital Twin
### Joint Cyclic Steam Stimulation (CSS) & Sucker Rod Pump (SRP) Optimization
**Problem Statement SIH26120 — Smart India Hackathon 2026**  
**Target Field:** Baghewala Heavy Oil Field, Rajasthan (17–19° API Crude)  
**Organization:** Oil India Limited (OIL)

---

## 🎯 Executive Summary

In the **Baghewala Field** (Jodhpur Sandstone formation), crude oil is extra-heavy ($17^\circ–19^\circ\text{ API}$) with dynamic viscosities exceeding $8{,}500\text{ cP}$ under native formation conditions. Production relies on Cyclic Steam Stimulation (CSS) to reduce in-situ viscosity, coupled with Sucker Rod Pumps (SRP) for artificial lift.

Traditionally, CSS steam planning and SRP surface operations have been managed in operational silos:
1. **CSS Steam Planning**: Run independently by reservoir engineers without continuous downhole pump feedback.
2. **SRP Lift Operations**: Adjusted reactively by field operators after severe mechanical failures, rod floating, or pump unseating occur.

**OIL-TWIN AI** delivers a first-principles coupled digital twin that synchronizes subsurface thermodynamic heat dissipation with sucker rod wave mechanics and automated ML diagnostic inference.

---

## 🌟 Key Capabilities & Features

* **3D Interactive Well-to-Surface Digital Twin**: Real-time WebGL visualization (Three.js) of surface walking-beam pumpjack reciprocation, wellhead Christmas tree, cutaway strata, casing/tubing strings, sucker rod stress heatmaps, and radial reservoir steam chambers.
* **Signature "What-If" Simulation Mode**: Live smooth interpolation between current field operating baseline and simulated optimized twin state, displaying real-time predictive delta uplifts.
* **Coupled First-Principles Twin**:
  * **Reservoir Thermal Model**: Boberg-Lundberg thermal dissipation & Andrade viscosity collapse equations.
  * **SRP Wave Dynamics**: Gibbs damped 1D wave equation for downhole pump card computation.
* **Explainable AI (SHAP Attribution)**: 6-class dynamometer card classifier (Normal, Rod Floating, Fluid Pound, Gas Interference, Pump Unseating, Tagging) with transparent SHAP feature attributions and 10-second decision explanations.
* **Multi-Objective Pareto Optimizer**: NSGA-II non-dominated sorting balancing Oil Uplift vs Steam-Oil Ratio (SOR) vs Mechanical Failure Risk.
* **Human-in-the-Loop Governance**: AI advisory recommendations require mandatory engineering rationale and record directly to an immutable audit trail (`/api/audit`).
* **SCADA / Telemetry Diagnostics**: Real-time WebSocket streaming (`~2s` cadence) with tag-level staleness monitoring, anomaly detection, and explicit `SIMULATION MODE` provenance disclosure.

---

## 🏗️ System Architecture

```
                    ┌────────────────────────────────────────────────────────┐
                    │                   OIL-TWIN AI Engine                   │
                    └───────────────────────────┬────────────────────────────┘
                                                │
                 ┌──────────────────────────────┴──────────────────────────────┐
                 ▼                                                             ▼
   ┌───────────────────────────┐                                 ┌───────────────────────────┐
   │     FastAPI Backend       │                                 │      React Frontend       │
   │  REST Endpoints + WebSockets│◄────── API Proxy (5173/api) ────┤  Three.js 3D Digital Twin │
   │  Boberg-Lundberg + 1D Wave│                                 │  ECharts + JetBrains Mono │
   └─────────────┬─────────────┘                                 └───────────────────────────┘
                 │
                 ▼
   ┌───────────────────────────┐
   │ SQLite / aiosqlite Store  │
   │ State, Audit & Recos      │
   └───────────────────────────┘
```

---

## 🚀 Quick Start Guide

### 1. Backend Service (FastAPI)
```bash
cd backend
python -m venv .venv
# Windows:
.venv\Scripts\activate
# Linux/macOS:
source .venv/bin/activate

pip install -r requirements.txt
python seed.py
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
* Interactive API Documentation (Swagger UI): [http://localhost:8000/docs](http://localhost:8000/docs)
* Health Status Endpoint: [http://localhost:8000/api/health](http://localhost:8000/api/health)

### 2. Frontend Application (React + Vite + Three.js)
```bash
cd frontend
npm install
npm run dev
```
* Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 🧪 Verification & Automated Testing

### Backend Endpoint Verification:
```bash
cd backend
python scripts/verify_endpoints.py
pytest tests/ -v
```

### Frontend Production Build:
```bash
cd frontend
npm run build
```

---

## 📄 Provenance & Engineering Notice
All telemetry and model outcomes default to **Simulated Data Mode** utilizing physics-based surrogate formulations calibrated to Baghewala Field reservoir parameters (17–19° API crude, Jodhpur Sandstone formation at ~1,100m depth).
