"""
Tests for Simulator: determinism, physical sanity, and mechanics.
"""
import numpy as np

from app.simulator.engine import SimulatorEngine
from app.simulator.reservoir import (
    compute_oil_viscosity_cp,
    compute_reservoir_temperature_decay,
)
from app.simulator.srp_mechanics import (
    compute_vectorized_dyno_card,
    evaluate_srp_condition,
)
from app.simulator.surface import compute_surface_metrics


def test_viscosity_temperature_sanity():
    """Verify Andrade/Walther viscosity behavior on Baghewala heavy crude."""
    mu_47 = compute_oil_viscosity_cp(47.0)
    mu_80 = compute_oil_viscosity_cp(80.0)
    mu_120 = compute_oil_viscosity_cp(120.0)
    mu_180 = compute_oil_viscosity_cp(180.0)
    mu_240 = compute_oil_viscosity_cp(240.0)

    # Monotonic decrease: heating must lower viscosity
    assert mu_47 > mu_80 > mu_120 > mu_180 > mu_240

    # Baghewala PVT ranges
    assert 6000.0 <= mu_47 <= 10000.0  # ~8500 cP at reservoir temp 47 C
    assert 100.0 <= mu_120 <= 400.0     # ~190 cP at 120 C
    assert 10.0 <= mu_180 <= 50.0       # ~22 cP at 180 C
    assert mu_240 < 10.0                # < 10 cP at steam injection conditions


def test_thermal_decay_monotonicity():
    """Verify Boberg-Lundberg thermal dissipation over production days."""
    t_peak = 180.0
    soak = 8.0
    t_day10 = compute_reservoir_temperature_decay(10.0, t_peak, soak)
    t_day30 = compute_reservoir_temperature_decay(30.0, t_peak, soak)
    t_day60 = compute_reservoir_temperature_decay(60.0, t_peak, soak)
    t_day120 = compute_reservoir_temperature_decay(120.0, t_peak, soak)

    assert t_day10 >= t_day30 >= t_day60 >= t_day120 >= 47.0


def test_srp_dyno_card_diagnostics():
    """Verify 6 card types, rod floating physics, and fluid pound."""
    # 1. High viscosity + high SPM -> rod floating
    diag, conf = evaluate_srp_condition(
        viscosity_cp=4500.0,
        spm=6.5,
        stroke_length_m=3.0,
        pump_fillage_pct=85.0,
        fluid_level_m=650.0,
    )
    assert diag == "rod_floating"
    assert conf >= 0.70

    # 2. Low fillage -> fluid pound
    diag_pound, conf_pound = evaluate_srp_condition(
        viscosity_cp=80.0,
        spm=4.5,
        stroke_length_m=2.8,
        pump_fillage_pct=52.0,
        fluid_level_m=650.0,
    )
    assert diag_pound == "fluid_pound"
    assert conf_pound >= 0.75

    # 3. Vectorized card shape sanity
    surf, down, r_max, r_min = compute_vectorized_dyno_card(
        diagnosis="rod_floating",
        stroke_length_m=3.0,
        spm=6.5,
        viscosity_cp=4500.0,
        pump_fillage_pct=85.0,
    )
    assert len(surf) == 100
    assert len(down) == 100
    assert r_max > r_min
    assert r_max < 150.0  # reasonable kN limit
    assert r_min >= 0.0   # physical tension clamp


def test_surface_metrics_sor_derivation():
    """Verify SOR is derived from steam and oil quantities, not arbitrary."""
    metrics = compute_surface_metrics(
        phase="production",
        stroke_length_m=2.8,
        spm=4.5,
        pump_fillage_pct=85.0,
        res_temp_c=120.0,
        res_pressure_bar=34.0,
        cum_steam_tonnes=1800.0,
        cum_oil_m3=450.0,
        electric_power_kw=18.0,
        day_in_cycle=25.0,
        soak_days=8.0,
    )
    assert metrics["oil_rate"] > 0.0
    assert metrics["sor"] > 0.0
    assert metrics["kwh_per_bbl"] > 0.0
    # Expected SOR roughly 1800 / 450 ~= 4.0
    assert 3.5 <= metrics["sor"] <= 4.5


def test_simulator_determinism():
    """Verify that two engines initialized with the same seed produce identical states."""
    eng1 = SimulatorEngine(n_wells=10, seed=42)
    eng2 = SimulatorEngine(n_wells=10, seed=42)

    w1_state = eng1.get_latest_state("BW-01")
    w2_state = eng2.get_latest_state("BW-01")

    assert w1_state.telemetry.reservoir.pressure == w2_state.telemetry.reservoir.pressure
    assert w1_state.telemetry.wellbore.bhp == w2_state.telemetry.wellbore.bhp
    assert w1_state.telemetry.surface.oil_rate == w2_state.telemetry.surface.oil_rate
    assert w1_state.telemetry.srp.k_w == w2_state.telemetry.srp.k_w
    assert len(eng1.history_buffer["BW-01"]) == len(eng2.history_buffer["BW-01"])


def test_demo_well_bw03_rod_floating():
    """Verify Well BW-03 exhibits rod floating and triggers critical alert."""
    eng = SimulatorEngine(n_wells=10, seed=42)
    state = eng.get_latest_state("BW-03")
    assert state.dyno_card.diagnosis == "rod_floating"
    alert_kinds = [a.kind for a in state.active_alerts]
    assert "rod_floating" in alert_kinds


def test_history_pregeneration():
    """Verify 30 days of history are pregenerated at startup."""
    eng = SimulatorEngine(n_wells=10, seed=42)
    hist = eng.get_history("BW-01")
    assert len(hist) >= 700  # 30 days * 24 hrs = 720 points
    assert hist[0].ts < hist[-1].ts


def test_all_6_dyno_classes_differ_measurably():
    """
    Verify all 6 dyno card classes produce measurably distinct geometric shapes
    when derived from physical operating conditions.
    """
    from app.schemas.dyno import DynoCard
    from app.simulator.srp_mechanics import extract_dyno_features

    classes = [
        "normal",
        "rod_floating",
        "fluid_pound",
        "gas_interference",
        "pump_unseating_risk",
        "tagging",
    ]
    extracted = {}

    for diag in classes:
        surf, down, _r_max, _r_min = compute_vectorized_dyno_card(
            diagnosis=diag,
            stroke_length_m=3.0,
            spm=5.0,
            viscosity_cp=3500.0 if diag == "rod_floating" else 150.0,
            pump_fillage_pct=45.0 if diag == "fluid_pound" else 88.0,
            rng=np.random.RandomState(42),
        )
        card = DynoCard(
            surface=surf,
            downhole=down,
            diagnosis=diag,
            confidence=0.9,
        )
        feats = extract_dyno_features(card)
        extracted[diag] = feats

    # 1. Rod floating has significantly lower downstroke minimum load due to slack
    assert extracted["rod_floating"]["down_load_min"] < 10.0
    assert extracted["normal"]["down_load_min"] > 15.0

    # 2. Fluid pound has high load derivative due to fluid impact on downstroke
    assert extracted["fluid_pound"]["max_load_derivative"] > extracted["normal"]["max_load_derivative"]

    # 3. Pump unseating risk has elevated peak load
    assert extracted["pump_unseating_risk"]["f_max"] > extracted["normal"]["f_max"] * 1.1

    # 4. Tagging has negative downhole spike at reversal
    assert extracted["tagging"]["dh_min"] < -5.0
    assert extracted["normal"]["dh_min"] >= -1.0

    # 5. Work areas are distinct across all classes
    work_areas = [extracted[d]["work_area"] for d in classes]
    assert len(set(work_areas)) == 6
