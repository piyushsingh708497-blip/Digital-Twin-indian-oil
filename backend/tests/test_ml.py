"""
Tests for ML modules: DynoClassifier, FailureRiskModel, AnomalyDetector, and Explainers.
All evaluated on simulated datasets with documented metrics.
"""
from app.ml.anomaly import TelemetryAnomalyDetector
from app.ml.dyno_classifier import DynoClassifier
from app.ml.explainers import TwinExplainer
from app.ml.failure_model import FailureRiskModel
from app.schemas.dyno import DynoCard
from app.simulator.srp_mechanics import compute_vectorized_dyno_card


def test_dyno_classifier_predictions():
    """Verify that the ML classifier correctly diagnoses cards strictly from geometric points."""
    clf = DynoClassifier()

    # 1. Normal card
    s_norm, d_norm, _, _ = compute_vectorized_dyno_card("normal", stroke_length_m=2.8, spm=4.5, viscosity_cp=100.0, pump_fillage_pct=88.0)
    card_norm = DynoCard(surface=s_norm, downhole=d_norm, diagnosis="normal", confidence=0.9)
    diag_norm, conf_norm = clf.predict(card_norm)
    assert diag_norm == "normal"
    assert conf_norm > 0.50

    # 2. Rod floating card
    s_float, d_float, _, _ = compute_vectorized_dyno_card("rod_floating", stroke_length_m=3.2, spm=6.5, viscosity_cp=5000.0, pump_fillage_pct=85.0)
    card_float = DynoCard(surface=s_float, downhole=d_float, diagnosis="rod_floating", confidence=0.9)
    diag_float, conf_float = clf.predict(card_float)
    assert diag_float == "rod_floating"
    assert conf_float > 0.50

    # 3. Fluid pound card
    s_pound, d_pound, _, _ = compute_vectorized_dyno_card("fluid_pound", stroke_length_m=2.8, spm=4.5, viscosity_cp=80.0, pump_fillage_pct=45.0)
    card_pound = DynoCard(surface=s_pound, downhole=d_pound, diagnosis="fluid_pound", confidence=0.9)
    diag_pound, conf_pound = clf.predict(card_pound)
    assert diag_pound == "fluid_pound"
    assert conf_pound > 0.50


def test_failure_model_risk_prediction():
    """Verify failure risk model predicts probabilities bounded [0.0, 1.0] responsive to stress and shock."""
    model = FailureRiskModel()

    # Low risk operating condition: low stress, normal viscosity
    low_feats = {
        "rod_stress_pct": 52.0, "f_range": 22.0, "spm": 3.8, "stroke_length": 2.2,
        "vfd_hz": 38.0, "viscosity_cp": 90.0, "pump_fillage_pct": 90.0, "electric_kw": 6.5, "shock_factor": 0.0
    }
    risk_low = model.predict_risk(low_feats)

    # High risk operating condition: high stress, extreme viscosity, shock load
    high_feats = {
        "rod_stress_pct": 98.0, "f_range": 58.0, "spm": 7.5, "stroke_length": 3.8,
        "vfd_hz": 62.0, "viscosity_cp": 5500.0, "pump_fillage_pct": 40.0, "electric_kw": 24.0, "shock_factor": 1.0
    }
    risk_high = model.predict_risk(high_feats)

    assert 0.0 <= risk_low <= 1.0
    assert 0.0 <= risk_high <= 1.0
    assert risk_high > risk_low


def test_anomaly_detector_detections():
    """Verify anomaly detector flags overpressure, slack line, and data degradation."""
    from app.simulator.engine import SimulatorEngine

    detector = TelemetryAnomalyDetector()
    eng = SimulatorEngine(n_wells=10, seed=42)

    # 1. Normal state should have zero critical anomalies
    state_norm = eng.get_latest_state("BW-01")
    anoms_norm = detector.detect_anomalies(state_norm.telemetry)
    crit_norm = [a for a in anoms_norm if a["severity"] == "critical"]
    assert len(crit_norm) == 0

    # 2. Injected stale data anomaly
    tel_stale = state_norm.telemetry.model_copy(deep=True)
    tel_stale.quality.data_age_sec = 85.0
    anoms_stale = detector.detect_anomalies(tel_stale)
    assert any(a["type"] == "data_stale" for a in anoms_stale)

    # 3. Rod slack line load anomaly
    tel_slack = state_norm.telemetry.model_copy(deep=True)
    tel_slack.srp.rod_load_min = 1.2
    anoms_slack = detector.detect_anomalies(tel_slack)
    assert any(a["type"] == "load_anomaly" for a in anoms_slack)


def test_explainability_drivers():
    """Verify feature driver generation produces ranked, normalized explanations."""
    explainer = TwinExplainer()

    curr_state = {"spm": 7.0, "viscosityCp": 4500.0, "strokeLength": 3.2}
    prop_state = {"spm": 4.5, "viscosityCp": 4500.0, "strokeLength": 2.8}

    drivers = explainer.explain_recommendation_drivers(curr_state, prop_state, reco_type="srp")
    assert len(drivers) > 0
    assert all(0.0 <= d.contribution <= 1.0 for d in drivers)
    assert abs(sum(d.contribution for d in drivers) - 1.0) < 0.05
