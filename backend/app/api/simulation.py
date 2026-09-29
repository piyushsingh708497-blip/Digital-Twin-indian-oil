"""OIL-TWIN AI - Simulation, CSS, SRP, Optimization, Prediction APIs"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.ml.models import get_ml_models
from app.models.db_models import OptimizationRun, Simulation
from app.schemas.schemas import (
    CSSSimulateRequest,
    OptimizationRequest,
    ProductionPredictRequest,
    RiskPredictRequest,
    SRPSimulateRequest,
    WhatIfRequest,
)
from app.services.simulation import (
    get_css_simulator,
    get_optimization_engine,
    get_srp_simulator,
    get_whatif_simulator,
)

router = APIRouter()

DISCLAIMER = "Simulation Recommendation — validate against field engineering constraints before operational use."
MODEL_NOTE = "Prototype ML prediction using synthetic demonstration data."


# ── CSS ───────────────────────────────────────────────────────────────────────

@router.post("/css/simulate")
def css_simulate(req: CSSSimulateRequest, db: Session = Depends(get_db)):
    sim = get_css_simulator()
    result = sim.simulate(
        steam_volume_m3=req.steam_volume_m3,
        injection_pressure_kpa=req.injection_pressure_kpa,
        soak_time_days=req.soak_time_days,
        production_cutoff_m3d=req.production_cutoff_m3d,
        cycle_number=req.cycle_number,
        current_reservoir_temp_c=req.current_reservoir_temp_c,
        current_viscosity_cp=req.current_viscosity_cp,
    )
    result["disclaimer"] = DISCLAIMER
    # Save simulation
    db.add(Simulation(
        well_id=req.well_id,
        scenario_name="CSS_SIMULATE",
        input_params=req.model_dump(),
        results=result,
        is_optimization=False,
    ))
    db.commit()
    return result


@router.post("/css/optimize")
def css_optimize(req: CSSSimulateRequest, db: Session = Depends(get_db)):
    opt = get_optimization_engine()
    base_params = {
        "current_reservoir_temp_c": req.current_reservoir_temp_c,
        "current_viscosity_cp": req.current_viscosity_cp,
        "current_reservoir_pressure_kpa": 4500.0,
        "cycle_number": req.cycle_number,
        "production_cutoff_m3d": req.production_cutoff_m3d,
        "stroke_length_m": 3.5,
        "spm": 8.0,
        "vfd_hz": 50.0,
    }
    result = opt.optimize(base_params)
    best = result["best_scenario"]
    alts = result["alternatives"]

    response = {
        "best_params": {**best.get("css_params", {}), "production_cutoff_m3d": req.production_cutoff_m3d},
        "best_score": result["optimization_score"],
        "predicted_production_m3": best["oil_production_m3"],
        "predicted_sor": best["sor"],
        "predicted_energy_kwh": best["energy_kwh"],
        "alternatives": [{"name": a["scenario_name"], "score": a["overall_score"],
                           "production_m3": a["oil_production_m3"], "sor": a["sor"]} for a in alts],
        "explanation": result["explanation"],
        "disclaimer": DISCLAIMER,
    }
    return response


# ── SRP ───────────────────────────────────────────────────────────────────────

@router.post("/srp/simulate")
def srp_simulate(req: SRPSimulateRequest, db: Session = Depends(get_db)):
    sim = get_srp_simulator()
    result = sim.simulate(
        stroke_length_m=req.stroke_length_m,
        spm=req.spm,
        vfd_hz=req.vfd_hz,
        reservoir_temp_c=req.reservoir_temp_c,
        reservoir_pressure_kpa=req.reservoir_pressure_kpa,
        viscosity_cp=req.viscosity_cp,
        pump_diameter_mm=req.pump_diameter_mm,
    )
    result["disclaimer"] = DISCLAIMER
    db.add(Simulation(
        well_id=req.well_id,
        scenario_name="SRP_SIMULATE",
        input_params=req.model_dump(),
        results=result,
        is_optimization=False,
    ))
    db.commit()
    return result


@router.post("/srp/optimize")
def srp_optimize(req: SRPSimulateRequest, db: Session = Depends(get_db)):
    opt = get_optimization_engine()
    base_params = {
        "current_reservoir_temp_c": req.reservoir_temp_c,
        "current_viscosity_cp": req.viscosity_cp,
        "current_reservoir_pressure_kpa": req.reservoir_pressure_kpa,
        "cycle_number": 5,
        "production_cutoff_m3d": 1.0,
        "steam_volume_m3": 1500,
        "injection_pressure_kpa": 6000,
        "soak_time_days": 10,
    }
    result = opt.optimize(base_params)
    best = result["best_scenario"]
    alts = result["alternatives"]
    return {
        "best_params": best.get("srp_params", {}),
        "best_score": result["optimization_score"],
        "predicted_rate_m3d": best["peak_rate_m3d"],
        "pump_efficiency_pct": best["pump_efficiency_pct"],
        "risk_score": best["overall_risk"],
        "alternatives": [{"name": a["scenario_name"], "score": a["overall_score"],
                           "rate_m3d": a["peak_rate_m3d"], "pump_eff": a["pump_efficiency_pct"]} for a in alts],
        "explanation": result["explanation"],
        "disclaimer": DISCLAIMER,
    }


# ── What-If Simulator ─────────────────────────────────────────────────────────

@router.post("/simulation/run")
def run_simulation(req: WhatIfRequest, db: Session = Depends(get_db)):
    sim = get_whatif_simulator()
    result = sim.run_scenario(req.model_dump(), req.scenario_name)

    explanation = []
    if result["reservoir_temp_c"] > 100:
        explanation.append(f"Steam effectively heated reservoir to {result['reservoir_temp_c']:.1f}°C.")
    if result["viscosity_cp"] < 1000:
        explanation.append(f"Viscosity reduced to {result['viscosity_cp']:.0f} cP — good mobility.")
    if result["sor"] > 5:
        explanation.append("High SOR — consider reducing steam volume to improve steam efficiency.")
    if result["overall_risk"] > 60:
        explanation.append("Elevated equipment risk — review SPM and stroke length settings.")
    if result["pump_efficiency_pct"] < 60:
        explanation.append("Low pump efficiency — viscosity may be too high for current SRP settings.")
    if not explanation:
        explanation.append("Operating parameters within acceptable range for this scenario.")

    result["explanation"] = explanation
    result["disclaimer"] = DISCLAIMER

    # Persist
    db.add(Simulation(
        well_id=req.well_id,
        scenario_name=req.scenario_name,
        input_params=req.model_dump(),
        results={k: v for k, v in result.items() if k != "heating_profile"},
        is_optimization=False,
    ))
    db.commit()
    return result


# ── Optimization ──────────────────────────────────────────────────────────────

@router.post("/optimization/run")
def run_optimization(req: OptimizationRequest, db: Session = Depends(get_db)):
    opt = get_optimization_engine()
    weights = {
        "production": req.weight_production,
        "efficiency": req.weight_efficiency,
        "energy": req.weight_energy,
        "sor": req.weight_sor,
        "risk": req.weight_risk,
    }
    base_params = {
        "current_reservoir_temp_c": req.current_reservoir_temp_c,
        "current_viscosity_cp": req.current_viscosity_cp,
        "current_reservoir_pressure_kpa": req.current_reservoir_pressure_kpa,
        "cycle_number": req.cycle_number,
        "production_cutoff_m3d": 1.0,
    }
    result = opt.optimize(base_params, weights)

    # Persist
    run = OptimizationRun(
        well_id=req.well_id,
        best_params={**result["best_scenario"].get("css_params", {}), **result["best_scenario"].get("srp_params", {})},
        best_score=result["optimization_score"],
        all_scenarios=[],  # Too large to store all
        explanation=result["explanation"],
    )
    db.add(run)
    db.commit()

    return {
        "best_scenario": {**result["best_scenario"], "is_recommended": True},
        "alternatives": result["alternatives"][:4],
        "optimization_score": result["optimization_score"],
        "explanation": result["explanation"],
        "weights_used": weights,
        "total_scenarios_evaluated": result.get("total_scenarios_evaluated", 720),
        "disclaimer": DISCLAIMER,
    }


# ── Predictions ────────────────────────────────────────────────────────────────

@router.post("/predict/production")
def predict_production(req: ProductionPredictRequest):
    ml = get_ml_models()
    result = ml.predict_production(req.model_dump())
    return {**result, "model_note": MODEL_NOTE}


@router.post("/predict/temperature")
def predict_temperature(req: ProductionPredictRequest):
    ml = get_ml_models()
    params = {
        "base_reservoir_temp_c": req.reservoir_temp_c,
        "steam_volume_m3": req.steam_volume_m3,
        "injection_pressure_kpa": req.injection_pressure_kpa,
        "soak_time_days": req.soak_time_days,
        "cycle_number": req.css_cycle_number,
        "reservoir_pressure_kpa": req.reservoir_pressure_kpa,
    }
    result = ml.predict_temperature(params)
    return {**result, "model_note": MODEL_NOTE}


@router.post("/predict/risk")
def predict_risk(req: RiskPredictRequest):
    ml = get_ml_models()
    result = ml.predict_risk(req.model_dump())
    return result
