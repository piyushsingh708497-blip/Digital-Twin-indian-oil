"""
OIL-TWIN AI - Database Seeder
Populates SQLite database with synthetic demonstration data.
DISCLAIMER: All data is synthetic and does not represent real Oil India operational data.
Designed for SIH26120 MVP demonstration only.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import random
from datetime import datetime, timedelta

import numpy as np

from app.database import SessionLocal, engine
from app.models.db_models import (
    Alert,
    Base,
    CSSCycle,
    EquipmentEvent,
    SRPOperation,
    Telemetry,
    Well,
)

np.random.seed(42)
random.seed(42)

Base.metadata.create_all(bind=engine)

WELL_DEFS = [
    {"well_id": "BAGH-001", "name": "Baghewala-1", "lat": 29.42, "lon": 72.14, "depth_m": 380, "spud": "2018-03-15"},
    {"well_id": "BAGH-002", "name": "Baghewala-2", "lat": 29.43, "lon": 72.16, "depth_m": 410, "spud": "2018-07-20"},
    {"well_id": "BAGH-003", "name": "Baghewala-3", "lat": 29.41, "lon": 72.12, "depth_m": 350, "spud": "2019-01-10"},
    {"well_id": "BAGH-004", "name": "Baghewala-4", "lat": 29.45, "lon": 72.18, "depth_m": 440, "spud": "2019-06-05"},
    {"well_id": "BAGH-005", "name": "Baghewala-5", "lat": 29.40, "lon": 72.13, "depth_m": 390, "spud": "2020-02-28"},
]

# Well-specific configurations (CSS + SRP baseline)
WELL_CONFIGS = {
    "BAGH-001": {"base_temp": 52, "base_visc": 18000, "base_steam": 1200, "base_spm": 8, "base_sl": 3.5, "health": "Healthy", "score": 88},
    "BAGH-002": {"base_temp": 45, "base_visc": 28000, "base_steam": 1600, "base_spm": 6, "base_sl": 3.0, "health": "Warning", "score": 72},
    "BAGH-003": {"base_temp": 60, "base_visc": 12000, "base_steam": 900,  "base_spm": 10,"base_sl": 4.0, "health": "Healthy", "score": 91},
    "BAGH-004": {"base_temp": 38, "base_visc": 42000, "base_steam": 2000, "base_spm": 5, "base_sl": 2.5, "health": "Critical","score": 55},
    "BAGH-005": {"base_temp": 55, "base_visc": 15000, "base_steam": 1100, "base_spm": 9, "base_sl": 3.8, "health": "Warning", "score": 68},
}


def viscosity_from_temp(base_v, base_t, target_t):
    T0 = base_t + 273.15
    T1 = target_t + 273.15
    B = 2800.0
    A = np.log(base_v) - B / T0
    return float(np.clip(np.exp(A + B / T1), 50, 100000))


def make_noise(val, pct=0.05):
    return val * (1 + np.random.uniform(-pct, pct))


def seed_wells(db):
    wells = {}
    for wd in WELL_DEFS:
        cfg = WELL_CONFIGS[wd["well_id"]]
        w = Well(
            well_id=wd["well_id"],
            name=wd["name"],
            field="Baghewala",
            latitude=wd["lat"],
            longitude=wd["lon"],
            depth_m=wd["depth_m"],
            spud_date=wd["spud"],
            status="Active",
            health_status=cfg["health"],
            health_score=cfg["score"],
        )
        db.add(w)
        wells[wd["well_id"]] = w
    db.flush()
    return wells


def seed_telemetry(db, wells):
    """90 days of daily telemetry for each well."""
    today = datetime.utcnow()
    for wid, well in wells.items():
        cfg = WELL_CONFIGS[wid]
        base_temp = cfg["base_temp"]
        base_visc = cfg["base_visc"]
        cycle = 4

        for day in range(90, 0, -1):
            ts = today - timedelta(days=day)
            # Simulate CSS cycle: injection every ~30 days
            if day % 30 == 0:
                cycle += 1

            # Reservoir state evolves
            steam_vol = make_noise(cfg["base_steam"])
            inj_pressure = make_noise(5500, 0.1)
            soak_days = make_noise(10, 0.2)

            temp_rise = 0.025 * steam_vol * np.sqrt(inj_pressure / 5000) - 2 * soak_days - 3 * (cycle - 1)
            temp_rise = max(0, temp_rise)
            res_temp = min(base_temp + temp_rise + np.random.normal(0, 3), 200)
            res_temp = max(res_temp, 30)

            visc = viscosity_from_temp(base_visc, base_temp, res_temp)
            visc = max(50, visc + np.random.normal(0, 200))

            spm = make_noise(cfg["base_spm"], 0.1)
            sl = make_noise(cfg["base_sl"], 0.05)
            vfd = make_noise(50, 0.05)
            pump_area = np.pi * (0.04445 / 2) ** 2
            theoretical = sl * pump_area * spm * 60 * 24
            opt_spm = 8.0
            pump_eff = max(20, min(95, 85 - 0.5 * ((spm - opt_spm) / opt_spm) ** 2 * 20 - 0.000008 * visc + np.random.normal(0, 3)))
            oil_rate = max(0.3, theoretical * (pump_eff / 100) * min(1, 1.0 / (1 + 0.00005 * visc)) + np.random.normal(0, 0.5))
            water_rate = oil_rate * make_noise(1.5, 0.2)

            energy = 2.5 * steam_vol + 150 * spm * sl + np.random.normal(0, 100)
            energy = max(500, energy)
            bbl_per_day = oil_rate * 6.289
            epb = energy / max(bbl_per_day, 0.1)
            prod_days = max(15, 60 - 3 * (cycle - 1))
            sor = steam_vol / max(oil_rate * prod_days, 1)

            t = Telemetry(
                well_id=well.id,
                timestamp=ts,
                reservoir_temp_c=round(res_temp, 1),
                reservoir_pressure_kpa=round(make_noise(4500, 0.1), 0),
                oil_viscosity_cp=round(visc, 0),
                water_saturation=round(make_noise(0.35, 0.1), 3),
                permeability_md=round(make_noise(800, 0.2), 0),
                wellbore_temp_c=round(res_temp - make_noise(8, 0.2), 1),
                wellbore_pressure_kpa=round(make_noise(3800, 0.1), 0),
                flow_rate_m3d=round(oil_rate + water_rate, 2),
                steam_volume_m3=round(steam_vol, 0),
                injection_pressure_kpa=round(inj_pressure, 0),
                steam_quality=round(make_noise(0.78, 0.05), 2),
                soak_time_days=round(soak_days, 1),
                css_cycle_number=cycle,
                stroke_length_m=round(sl, 2),
                spm=round(spm, 1),
                vfd_hz=round(vfd, 1),
                pump_efficiency_pct=round(pump_eff, 1),
                rod_load_kn=round(make_noise(35, 0.1), 1),
                oil_rate_m3d=round(oil_rate, 2),
                water_rate_m3d=round(water_rate, 2),
                gas_rate_m3d=round(make_noise(0.1, 0.5), 3),
                gor=round(make_noise(5, 0.3), 2),
                energy_kwh=round(energy, 0),
                energy_per_barrel_kwh=round(epb, 2),
                steam_oil_ratio=round(sor, 2),
            )
            db.add(t)

    db.flush()


def seed_css_cycles(db, wells):
    for wid, well in wells.items():
        cfg = WELL_CONFIGS[wid]
        for cycle in range(1, 8):
            start = datetime.utcnow() - timedelta(days=(8 - cycle) * 30)
            steam = cfg["base_steam"] * (1 - 0.03 * (cycle - 1))
            prod_days = max(15, 60 - 3 * (cycle - 1))
            peak_rate = max(0.5, 15 - 0.5 * cycle + np.random.normal(0, 1))
            total_oil = peak_rate * prod_days * 0.6

            cc = CSSCycle(
                well_id=well.id,
                cycle_number=cycle,
                start_date=start.strftime("%Y-%m-%d"),
                steam_volume_m3=round(steam),
                injection_pressure_kpa=round(make_noise(5500, 0.1)),
                injection_duration_days=round(make_noise(5, 0.2), 1),
                steam_quality=round(make_noise(0.78, 0.05), 2),
                soak_time_days=round(make_noise(10, 0.2), 1),
                production_duration_days=prod_days,
                peak_oil_rate_m3d=round(peak_rate, 2),
                total_oil_m3=round(total_oil, 1),
                production_cutoff_m3d=1.0,
                sor=round(steam / max(total_oil, 1), 2),
                energy_kwh=round(steam * 2.5 + 150 * prod_days),
                reservoir_temp_peak_c=round(cfg["base_temp"] + 0.025 * steam, 1),
            )
            db.add(cc)
    db.flush()


def seed_srp_operations(db, wells):
    for wid, well in wells.items():
        cfg = WELL_CONFIGS[wid]
        for i in range(10):
            ts = datetime.utcnow() - timedelta(days=i * 9)
            sop = SRPOperation(
                well_id=well.id,
                timestamp=ts,
                stroke_length_m=round(make_noise(cfg["base_sl"], 0.05), 2),
                spm=round(make_noise(cfg["base_spm"], 0.1), 1),
                vfd_hz=round(make_noise(50, 0.05), 1),
                pump_efficiency_pct=round(make_noise(70, 0.1), 1),
                rod_load_kn=round(make_noise(35, 0.15), 1),
                torque_nm=round(make_noise(800, 0.15), 0),
                rod_floating_risk=round(max(0, min(100, 20 + np.random.normal(0, 15))), 1),
                impact_loading_risk=round(max(0, min(100, 15 + np.random.normal(0, 12))), 1),
                pump_unsetting_risk=round(max(0, min(100, 18 + np.random.normal(0, 14))), 1),
                rod_failure_risk=round(max(0, min(100, 12 + np.random.normal(0, 10))), 1),
            )
            db.add(sop)
    db.flush()


def seed_equipment_events(db, wells):
    events = [
        ("BAGH-002", "rod_floating", "High", "Rod floating detected during cycle 5 production phase. SPM reduced temporarily.", "2026-07-15"),
        ("BAGH-004", "pump_unsetting", "Critical", "Pump unsetting event. High viscosity fluid at low temperature. CSS cycle initiated.", "2026-08-02"),
        ("BAGH-004", "impact_loading", "High", "Elevated impact loading detected. Stroke length adjusted.", "2026-08-20"),
        ("BAGH-005", "rod_floating", "Medium", "Mild rod floating — monitor closely.", "2026-09-01"),
        ("BAGH-001", "rod_failure", "Low", "Minor rod wear detected during routine inspection. Replaced.", "2026-06-10"),
    ]
    for wid, etype, severity, desc, date in events:
        well = wells.get(wid)
        if well:
            db.add(EquipmentEvent(
                well_id=well.id,
                timestamp=datetime.strptime(date, "%Y-%m-%d"),
                event_type=etype,
                severity=severity,
                description=desc,
                resolved=(severity in ["Low", "Medium"]),
            ))
    db.flush()


def seed_alerts(db, wells):
    alert_defs = [
        ("BAGH-001", "info", "css", "CSS Cycle Optimization Available", "Cycle 8 steam parameters can be optimized to reduce SOR by ~12%. Run CSS Optimizer.", False, False),
        ("BAGH-002", "warning", "equipment", "Increasing Rod-Floating Risk", "Rod-floating risk at 58/100. Monitor pump performance and consider reducing SPM.", False, False),
        ("BAGH-003", "info", "production", "Production Above Target", "BAGH-003 is producing 8% above forecast. Continue current CSS parameters.", True, False),
        ("BAGH-004", "critical", "equipment", "High Equipment Failure Risk", "Overall equipment risk at 74/100. Immediate review of SRP and CSS parameters recommended.", False, False),
        ("BAGH-004", "warning", "css", "Reservoir Cooling Detected", "Reservoir temperature dropped 12°C since last CSS cycle. Consider early steam injection.", False, False),
        ("BAGH-005", "warning", "energy", "Steam-Oil Ratio Increasing", "SOR increased from 3.2 to 4.8 over 3 cycles. Review steam injection parameters.", False, False),
        ("BAGH-001", "info", "srp", "SRP Optimization Opportunity", "Minor VFD adjustment (52→48 Hz) may improve pump efficiency by ~5%.", True, True),
    ]
    for wid, atype, cat, title, msg, ack, resolved in alert_defs:
        well = wells.get(wid)
        if well:
            db.add(Alert(
                well_id=well.id,
                timestamp=datetime.utcnow() - timedelta(hours=random.randint(1, 72)),
                alert_type=atype,
                category=cat,
                title=title,
                message=msg,
                acknowledged=ack,
                resolved=resolved,
            ))
    db.flush()


def main():
    db = SessionLocal()
    try:
        # Clear existing data
        print("Clearing existing data...")
        db.query(Alert).delete()
        db.query(EquipmentEvent).delete()
        db.query(SRPOperation).delete()
        db.query(CSSCycle).delete()
        db.query(Telemetry).delete()
        db.query(Well).delete()
        db.commit()

        print("Seeding wells...")
        wells = seed_wells(db)

        print("Seeding telemetry (90 days × 5 wells)...")
        seed_telemetry(db, wells)

        print("Seeding CSS cycles...")
        seed_css_cycles(db, wells)

        print("Seeding SRP operations...")
        seed_srp_operations(db, wells)

        print("Seeding equipment events...")
        seed_equipment_events(db, wells)

        print("Seeding alerts...")
        seed_alerts(db, wells)

        db.commit()
        print("\n[OK] Database seeded successfully!")
        print("   DISCLAIMER: All data is synthetic demonstration data.")
        print("   Not OIL Confidential Data.")

    except Exception as e:
        db.rollback()
        print(f"[ERROR] Seeding failed: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
