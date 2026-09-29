"""OIL-TWIN AI - Alerts and Reports APIs"""
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.database import get_db
from app.ml.models import get_ml_models
from app.models.db_models import Alert, CSSCycle, SRPOperation, Telemetry, Well

router = APIRouter()


@router.get("/alerts")
def get_alerts(well_id: str | None = None, db: Session = Depends(get_db)):
    q = db.query(Alert)
    if well_id:
        well = db.query(Well).filter(Well.well_id == well_id).first()
        if well:
            q = q.filter(Alert.well_id == well.id)
    alerts = q.order_by(desc(Alert.timestamp)).limit(50).all()
    return [
        {
            "id": a.id,
            "well_id": a.well_id,
            "well_name": db.query(Well).filter(Well.id == a.well_id).first().well_id if a.well_id else None,
            "alert_type": a.alert_type,
            "category": a.category,
            "title": a.title,
            "message": a.message,
            "acknowledged": a.acknowledged,
            "resolved": a.resolved,
            "timestamp": str(a.timestamp),
        }
        for a in alerts
    ]


@router.post("/alerts/{alert_id}/acknowledge")
def acknowledge_alert(alert_id: int, db: Session = Depends(get_db)):
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert.acknowledged = True
    db.commit()
    return {"success": True, "message": "Alert acknowledged"}


@router.post("/alerts/{alert_id}/resolve")
def resolve_alert(alert_id: int, db: Session = Depends(get_db)):
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert.resolved = True
    alert.resolved_at = datetime.utcnow()
    db.commit()
    return {"success": True, "message": "Alert resolved"}


@router.get("/reports/{well_id}")
def get_report(well_id: str, db: Session = Depends(get_db)):
    well = db.query(Well).filter(Well.well_id == well_id).first()
    if not well:
        raise HTTPException(status_code=404, detail=f"Well {well_id} not found")

    tel = (
        db.query(Telemetry)
        .filter(Telemetry.well_id == well.id)
        .order_by(desc(Telemetry.id))
        .first()
    )

    last_css = (
        db.query(CSSCycle)
        .filter(CSSCycle.well_id == well.id)
        .order_by(desc(CSSCycle.id))
        .first()
    )

    last_srp = (
        db.query(SRPOperation)
        .filter(SRPOperation.well_id == well.id)
        .order_by(desc(SRPOperation.id))
        .first()
    )

    ml = get_ml_models()

    # Current risk
    risk_params = {
        "viscosity_cp": tel.oil_viscosity_cp if tel else 5000,
        "reservoir_temp_c": tel.reservoir_temp_c if tel else 80,
        "reservoir_pressure_kpa": tel.reservoir_pressure_kpa if tel else 4500,
        "spm": tel.spm if tel else 8,
        "stroke_length_m": tel.stroke_length_m if tel else 3.5,
        "vfd_hz": tel.vfd_hz if tel else 50,
        "pump_efficiency_pct": tel.pump_efficiency_pct if tel else 70,
        "oil_rate_m3d": tel.oil_rate_m3d if tel else 5,
    }
    risk = ml.predict_risk(risk_params)

    report = {
        "well_id": well.well_id,
        "well_name": well.name,
        "field": well.field,
        "generated_at": datetime.utcnow().isoformat(),
        "data_disclaimer": "Synthetic Demonstration Dataset — Not OIL Confidential Data",
        "well_state": {
            "health_status": well.health_status,
            "health_score": well.health_score,
            "reservoir_temp_c": tel.reservoir_temp_c if tel else None,
            "reservoir_pressure_kpa": tel.reservoir_pressure_kpa if tel else None,
            "oil_viscosity_cp": tel.oil_viscosity_cp if tel else None,
            "oil_rate_m3d": tel.oil_rate_m3d if tel else None,
        },
        "css_parameters": {
            "cycle_number": last_css.cycle_number if last_css else None,
            "steam_volume_m3": last_css.steam_volume_m3 if last_css else None,
            "injection_pressure_kpa": last_css.injection_pressure_kpa if last_css else None,
            "soak_time_days": last_css.soak_time_days if last_css else None,
            "sor": last_css.sor if last_css else None,
        },
        "srp_parameters": {
            "stroke_length_m": last_srp.stroke_length_m if last_srp else tel.stroke_length_m if tel else None,
            "spm": last_srp.spm if last_srp else tel.spm if tel else None,
            "vfd_hz": last_srp.vfd_hz if last_srp else tel.vfd_hz if tel else None,
            "pump_efficiency_pct": last_srp.pump_efficiency_pct if last_srp else tel.pump_efficiency_pct if tel else None,
        },
        "production_prediction": {
            "note": "Prototype ML prediction using synthetic demonstration data.",
            "current_rate_m3d": tel.oil_rate_m3d if tel else None,
        },
        "temperature_prediction": {
            "current_reservoir_temp_c": tel.reservoir_temp_c if tel else None,
        },
        "equipment_risk": risk,
        "energy_metrics": {
            "energy_kwh_per_day": tel.energy_kwh if tel else None,
            "energy_per_barrel_kwh": tel.energy_per_barrel_kwh if tel else None,
            "steam_oil_ratio": tel.steam_oil_ratio if tel else None,
        },
        "explanation": [
            "This report is automatically generated from the OIL-TWIN AI Digital Twin.",
            f"Well {well.well_id} is currently in {well.health_status} status.",
            f"Equipment risk level: {risk['severity']} ({risk['overall_risk']:.1f}/100).",
            "Refer to What-If Simulator and Optimization Engine for scenario recommendations.",
            "IMPORTANT: All values are from synthetic demonstration data. Validate against real field data before operational decisions.",
        ],
        "validation_disclaimer": "Simulation Recommendation — validate against field engineering constraints before operational use.",
    }
    return report
