# OIL-TWIN AI — BACKEND

**AI-Enabled Well-to-Surface Digital Twin for Cyclic Steam Stimulation (CSS) and Sucker Rod Pump (SRP) Operations**  
*Problem Statement: SIH26120 | Organization: Oil India Limited (OIL) | Target Field: Baghewala Heavy Oil Field, Rajasthan*

---

> ### ⚠️ Critical Real-World Engineering Notice
> **Real Baghewala SCADA and field sensor data was not available during development.**  
> Therefore:
> * Telemetry time-series is generated via a deterministic, physics-inspired simulation layer.
> * Machine learning diagnostic models are trained and evaluated on physics-inspired synthetic distributions.
> * Numerical predictions and recommendations are **not field-validated**.
> * The simulator uses engineering approximations (Walther-Andrade viscosity equations, Boberg-Lundberg thermal dissipation, and 1D damped wave mechanics).
> * Any production deployment requires field calibration and validation with real well telemetry.

---

## 1. Project Overview

In the Baghewala Field (Jodhpur Sandstone formation), crude oil is extra-heavy ($17^\circ–19^\circ$ API) with reservoir temperature of $46^\circ–48^\circ\text{C}$ and dynamic viscosity exceeding $8{,}500\text{ cP}$ under native formation conditions. Pumping operations suffer from severe mechanical issues: **rod floating** (viscous drag on downstroke exceeds rod buoyant weight, causing rod string buckling and parted rods), traveling valve impact loading (**fluid pound**), gas interference, and pump unseating risk.

Historically, CSS cycle parameters (steam volume, injection pressure, soak duration, production water-cut cutoff) and SRP parameters (stroke length, SPM, VFD frequency) have been operated in silos by separate teams:
* CSS steam volume is planned by reservoir engineers without real-time pump operating feedback.
* SRP speeds are adjusted reactively by surface operators after mechanical failures or severe rod floating occur.

**OIL-TWIN AI** couples reservoir thermal-viscosity dynamics directly with downhole rod mechanics and surface telemetry, executing bidirectional what-if forecasting, automated dyno card classification, failure risk attribution, and multi-objective joint optimization.

---

## 2. Architecture

```
                       ┌──────────────────────────────────────────────────┐
                       │           FastAPI Application Gateway            │
                       │   CORS Middleware | Provenance (X-Data-Mode)     │
                       └─────────────────────────┬────────────────────────┘
                                                 │
            ┌────────────────────────────────────┼────────────────────────────────────┐
            ▼                                    ▼                                    ▼
┌───────────────────────┐            ┌───────────────────────┐            ┌───────────────────────┐
│     REST Endpoints    │            │  WebSocket Streaming  │            │ Data Health & Faults  │
│  /api/wells, /state,  │            │  /ws/telemetry/{id}   │            │ /api/wells/{id}/health│
│  /css/forecast, /joint│            │  ~2s frame interval   │            │ /api/dev/faults       │
└───────────┬───────────┘            └───────────┬───────────┘            └───────────┬───────────┘
            │                                    │                                    │
            └────────────────────────────────────┼────────────────────────────────────┘
                                                 │
                                                 ▼
                               ┌───────────────────────────────────┐
                               │   DataSource Connector Contract   │
                               │        (app.connectors.base)      │
                               └─────────┬───────────────┬─────────┘
                                         │               │
                     ┌───────────────────┘               └───────────────────┐
                     ▼                                                       ▼
       ┌───────────────────────────┐                           ┌───────────────────────────┐
       │   SimulatedSource (Active)│                           │   ScadaSource (Adapter)   │
       │   Multi-well Physics Eng. │                           │   OPC-UA / MQTT / Modbus  │
       └─────────────┬─────────────┘                           └───────────────────────────┘
                     │
       ┌─────────────┴───────────────────────────────────────────────────────┐
       ▼                                                                     ▼
┌──────────────────────────────────────────────┐              ┌───────────────────────────────────┐
│              Physics Twin Layer              │              │         Machine Learning          │
│ • CSS Boberg-Lundberg Thermal-Inflow Model   │              │ • 6-Class Dyno Card Classifier    │
│ • SRP Vectorized 1D Damped Wave Mechanics   │◄────────────►│   (RandomForest: Accuracy 97.3%)  │
│ • Bidirectional Thermal-Drawdown Coupling    │              │ • Rod Failure Risk Regressor      │
│ • Multi-Objective Pareto Optimizer           │              │ • SHAP Recommendation Drivers     │
└──────────────────────────────────────────────┘              └───────────────────────────────────┘
```

---

## 3. Data Flow

1. **Telemetry Generation**: `SimulatorEngine` updates dynamic states (reservoir pressure decay, BHT dissipation, fluid level drawdown, rod loads, surface flow) across all wells.
2. **Connector Ingestion**: `SimulatedSource` exposes `get_wells()`, `get_well_state()`, `get_well_history()`, and `get_telemetry_stream()`.
3. **Twin Analysis**:
   - `/css/forecast` simulates future oil production with Monte Carlo uncertainty bands ($P10 \le P50 \le P90$) and computes unclamped Steam-Oil Ratio (SOR).
   - `/srp/analysis` executes vectorized 1D wave dynamics, generates surface and downhole cards (80 coordinate points each), predicts Goodman stress %, and classifies card shape.
   - `/joint` evaluates coupled reservoir drawdown and thermal mechanics, comparing an empirical historical baseline (`baselineSeparate`) against synchronized `jointOptimized` setpoints.
4. **Advisory Recommendations**: Generated by `RecommendationEngine` with SHAP drivers (`feature`, `contribution`), stored as `pending` in the database.
5. **Decision & Audit Ledger**: Operators accept, reject, or modify recommendations with mandatory engineering rationale via `POST /api/recommendations/{id}/decision`, recorded in an append-only audit log.

---

## 4. Simulator

Implemented in `app/simulator/`:
* **`reservoir.py`**:
  - Viscosity model: Walther-Andrade equation ($\mu = f(T)$) calibrated for Baghewala crude:
    $$\log_{10} \log_{10} (\nu + 0.7) = A - B \cdot \log_{10}(T + 273.15)$$
    At native formation temperature ($47^\circ\text{C}$), viscosity is $\approx 8{,}500\text{ cP}$. At saturated steam temperature ($230^\circ\text{C}$), viscosity drops to $\approx 5.3\text{ cP}$.
  - Thermal decay: Boberg-Lundberg conductive dissipation back to native formation temperature ($47^\circ\text{C}$).
* **`css_cycle.py`**: Finite state machine transitioning through `injection` $\to$ `soak` $\to$ `production` $\to$ `idle`.
* **`srp_mechanics.py`**:
  - Gibbs 1D damped wave equation discretization generating surface and downhole cards across 6 physical regimes:
    1. `normal`
    2. `rod_floating` (delayed downstroke fall, low peak load, bottom card slack)
    3. `fluid_pound` (traveling valve slap, severe load drop during mid-downstroke)
    4. `gas_interference` (delayed compressive uptake)
    5. `pump_unseating_risk` (high upstroke frictional drag exceeding hold-down force)
    6. `tagging` (mechanical bottom impact spike)
* **`surface.py`**: Computes water cut progression, oil rate, unclamped SOR ($V_{\text{steam}} / V_{\text{oil}}$), and electric power intensity ($\text{kWh/bbl}$). If oil is zero, both return `None` (`null` in JSON).
* **`events.py`**: Fault injection manager supporting `sensor_dropout`, `stale_telemetry`, and connectivity loss.

---

## 5. Digital Twin Models

Implemented in `app/twin/`:
* **`css_model.py`**: Boberg-Lundberg analytical surrogate with:
  - Saturation temperature calculated from injection pressure ($P_{\text{inj}}$).
  - Composite heat-loss and radial boundary thermal resistance enforcing diminishing returns at high steam volumes.
  - Excessive soak penalty modeling thermal dissipation during over-soaking.
  - Monte Carlo sampling generating certified $P10 \le P50 \le P90$ production uncertainty curves.
* **`srp_model.py`**: Sucker rod pump electro-mechanical surrogate computing polished rod load, Goodman fatigue stress %, and electric power.
* **`coupling.py`**: **Bidirectional Physical Coupling**:
  - *Path 1 (CSS $\to$ SRP)*: Steam volume and soak heating increase bottom-hole temperature $\to$ lower fluid viscosity $\to$ lower downstroke viscous drag and rod floating probability.
  - *Path 2 (SRP $\to$ CSS)*: SRP displacement lowers annular fluid level $\to$ increases drawdown pressure across sandface $\to$ enhances near-wellbore CSS inflow rate.

---

## 6. Machine Learning System

Implemented in `app/ml/`:
* **Dyno Card Classifier (`dyno_classifier.py`)**:
  - Trained **strictly** on geometric card features (aspect ratio, downstroke slope, load variance, turnaround derivative shocks, fillage fraction, bottom slack count).
  - **Never** ingests simulator internal state, hidden flags, or telemetry.
  - Random Forest architecture (100 estimators, max depth 12).
  - Evaluated on independent test split of 180 cards: **Accuracy: 97.33%, Macro F1: 0.9734**.
* **Rod Failure Model (`failure_model.py`)**:
  - Gradient Boosting Regressor predicting mechanical failure risk $[0.0, 1.0]$ based on cyclic Goodman stress %, load range, SPM, fluid pound shocks, and crude viscosity.
  - Evaluated on 300 test scenarios: **$R^2 = 0.9615$, Binary AUC: 0.9738**.
* **Explainability (`explainers.py`)**:
  - TreeExplainer / SHAP contribution attribution for recommendation drivers.
  - If TreeExplainer is unavailable, falls back to model-native Gini importances with explicit fallback labeling.

All metrics are serialized in `app/ml/saved_models/metrics_report.json` and clearly labeled "on simulated data".

---

## 7. Optimization

Implemented in `app/optimizer/`:
* **Variables**:
  - CSS: `steamVolumeTonnes` ($100–5000\text{ t}$), `injPressure` ($10–250\text{ bar}$), `soakDays` ($1–30\text{ d}$), `productionCutoffWaterCut` ($50–99\%$).
  - SRP: `strokeLength` ($0.5–4.5\text{ m}$), `spm` ($1.0–15.0$), `vfdHz` ($10.0–70.0\text{ Hz}$).
* **Baseline vs Joint Comparison**:
  - `baselineSeparate`: Represents standard field practice where CSS and SRP are optimized independently without dynamic feedback.
  - `jointOptimized`: Evaluates coupled thermal drawdown dynamics.
  - Honest deltas: Reports true improvement deltas; if joint yields zero or negative gain under constrained conditions, it is returned honestly without artificial padding.
* **Multi-Objective Pareto Front**:
  - Optimizes across 4 competing objectives: **Maximize Oil Rate**, **Minimize SOR**, **Minimize Energy Intensity (kWh/bbl)**, and **Minimize Rod Failure Risk**.

---

## 8. Recommendation Workflow

1. Recommendations are generated as **strictly advisory** (`app/reco/`). They are **never automatically applied** to running equipment.
2. Human-in-the-loop decisions (`accepted`, `rejected`, `modified`) require a mandatory non-empty engineering reason (`min_length=3`).
3. Submitting a decision persists an append-only event to the `audit_events` ledger.

---

## 9. API Specification

All JSON responses follow camelCase naming conventions.

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/wells` | List all monitored wells in Baghewala field |
| `GET` | `/api/wells/{id}/state` | Real-time state (Telemetry, DynoCard, active Alerts) |
| `GET` | `/api/wells/{id}/history` | Historical telemetry time-series replay (24h to 30d) |
| `POST` | `/api/wells/{id}/css/forecast` | What-if CSS production forecast with P10/P50/P90 |
| `POST` | `/api/wells/{id}/srp/analysis` | What-if SRP setpoint analysis with dyno card synthesis |
| `GET` | `/api/wells/{id}/joint` | Joint CSS+SRP optimization vs separate baseline |
| `GET` | `/api/wells/{id}/recommendations` | Advisory recommendations with SHAP drivers |
| `POST` | `/api/recommendations/{id}/decision` | Human engineering decision (accepted/rejected/modified) |
| `GET` | `/api/alerts` | Active operational alerts across all wells |
| `POST` | `/api/alerts/{id}/acknowledge` | Acknowledge active alert |
| `GET` | `/api/audit` | Append-only audit trail of decisions and system events |
| `GET` | `/api/wells/{id}/data-health` | Sensor staleness, dropouts, and quality diagnostics |
| `GET` | `/api/field/summary` | Aggregate field production, SOR, and at-risk wells |
| `GET` | `/api/meta` | System metadata, model capabilities, and limitations |
| `POST` | `/api/dev/faults` | Inject synthetic sensor dropouts or communication faults |
| `GET` | `/api/health` | Service health and subsystem component readiness |

---

## 10. WebSocket Telemetry

* **Endpoint**: `WS /ws/telemetry/{id}` (e.g. `/ws/telemetry/BW-01`)
* Streams a complete `Telemetry` JSON frame every $\approx 2\text{ seconds}$ matching the exact camelCase contract (`kW`, `kWhPerBbl`, `pumpFillagePct`, `waterCutPct`, etc.).
* Supports automatic reconnects and client disconnects without server resource leaks.

---

## 11. Database

* **Engine**: Async SQLAlchemy 2.0 with `aiosqlite` SQLite driver.
* **Tables**:
  - `wells`: Persistent well metadata and cycle phase.
  - `recommendations`: Advisory optimization recommendations.
  - `decisions`: Human decisions with engineering rationales.
  - `alerts`: Active and historical operational alerts.
  - `audit_events`: Strictly append-only ledger of all decisions and critical events.
  - `scenarios`: What-if optimization scenario snapshots.

---

## 12. Running Locally

```powershell
# 1. Navigate to backend directory
cd oil-twin-ai/backend

# 2. Activate virtual environment
.\.venv\Scripts\activate

# 3. Seed demo database with initial states
python scripts/seed_demo.py

# 4. Start FastAPI server
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Interactive documentation is available at:
* Swagger UI: `http://localhost:8000/docs`
* ReDoc: `http://localhost:8000/redoc`

---

## 13. Testing

Run the full pytest suite (unit, integration, twin, ML, API, WebSocket, degradation):

```powershell
pytest tests/ -v
```

All 49 tests execute in $\approx 23\text{ seconds}$ with a 100% pass rate.

---

## 14. Benchmarking

Measure true HTTP API latency through the ASGI stack:

```powershell
python scripts/benchmark.py
```

### Measured HTTP/API Latency (100 Requests per Endpoint)

| Endpoint | Mean | p50 | p95 | p99 |
|---|---|---|---|---|
| `POST /api/wells/BW-01/css/forecast` | 2.34 ms | **2.28 ms** | **2.80 ms** | **3.12 ms** |
| `POST /api/wells/BW-01/srp/analysis` | 2.06 ms | **2.02 ms** | **2.57 ms** | **2.91 ms** |
| `GET /api/wells/BW-01/joint` | 35.30 ms | **32.20 ms** | **39.13 ms** | **147.80 ms** |
| `GET /api/wells/BW-01/state` | 1.64 ms | **1.50 ms** | **2.45 ms** | **2.84 ms** |
| `GET /api/field/summary` | 7.53 ms | **6.20 ms** | **7.61 ms** | **10.84 ms** |

*All what-if and twin endpoints easily satisfy the $< 200\text{ ms}$ p95 real HTTP latency requirement.*

---

## 15. Docker Deployment

Build and run using Docker Compose:

```bash
docker-compose up --build
```

---

## 16. Limitations

1. **Simulated Data**: Real Baghewala SCADA/telemetry was not available during development.
2. **Simplified Inflow**: Multi-phase fluid flow in Jodhpur Sandstone reservoir is represented by a coupled Boberg-Lundberg thermal dissipation surrogate rather than a full 3D composition reservoir model (e.g. CMG STARS).
3. **Dyno Friction Approximation**: Rod-tubing contact friction uses lumped Coulomb-viscous friction formulations.

---

## 17. Sim-to-Real Gap

When deploying to actual Baghewala wells:
1. **Fluid Property Calibration**: Oil viscosity-temperature curves must be calibrated from laboratory PVT fluid samples.
2. **Dynamometer Calibration**: Downhole card reconstruction must be tuned against downhole memory gauge data.
3. **Inflow Performance**: Productivity index ($J$) and drainage radius ($r_e$) require pressure transient test calibration.

---

## 18. Future SCADA Integration

The backend is built around the `DataSource` abstraction (`app.connectors.base.DataSource`). To transition from simulation to live field data:
1. Implement `ScadaSource` in `app/connectors/scada.py` using OPC-UA, MQTT, or Modbus TCP.
2. Set environment variable `DATA_MODE=scada` in `.env`.
3. The rest of the application (Physics Twin, ML Classifier, Optimizer, Recommendation Engine, Audit System, WebSocket streamer) remains unchanged.
