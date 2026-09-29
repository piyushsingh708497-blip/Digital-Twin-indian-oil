"""
Tests for Physics Twin Models (twin/):
1. CSS surrogate monotonicity, diminishing returns, and SOR behavior
2. P10 <= P50 <= P90 bounds at all forecast days
3. Determinism with seed
4. SRP mechanics sanity: fluid pound, rod floating, stroke vs stress
5. Coupling paths 1 and 2 demonstrably alter downstream models
6. Setpoint clamping & warnings
7. Measured timing test for what-if latency
"""
import time

from app.schemas.css import CssParams
from app.schemas.srp import SrpSetpoints
from app.twin.coupling import CoupledTwin
from app.twin.css_model import CssTwinModel
from app.twin.srp_model import SrpTwinModel


def test_css_monotonicity_and_diminishing_returns():
    """
    Verify physical behavior:
    1. Higher steam volume increases cumulative oil produced.
    2. Marginal oil gain diminishes (sub-linear returns).
    3. Steam-Oil Ratio (SOR) worsens at high steam volumes.
    """
    twin = CssTwinModel(n_monte_carlo=50, seed=42)

    # 3 steam injection volumes: low, medium, high
    p_low = CssParams(steam_volume_tonnes=800.0, inj_pressure=140.0, soak_days=8.0, production_cutoff_water_cut=90.0)
    p_med = CssParams(steam_volume_tonnes=1600.0, inj_pressure=140.0, soak_days=8.0, production_cutoff_water_cut=90.0)
    p_high = CssParams(steam_volume_tonnes=3200.0, inj_pressure=140.0, soak_days=8.0, production_cutoff_water_cut=90.0)

    f_low, _ = twin.forecast(p_low)
    f_med, _ = twin.forecast(p_med)
    f_high, _ = twin.forecast(p_high)

    # 1. Monotonic increase in cumulative oil
    assert f_low.cum_oil < f_med.cum_oil < f_high.cum_oil

    # 2. Diminishing returns: delta from low->med must exceed delta from med->high for same doubling
    delta_low_med = f_med.cum_oil - f_low.cum_oil
    delta_med_high = f_high.cum_oil - f_med.cum_oil
    assert delta_low_med > delta_med_high

    # 3. SOR worsens (increases) as steam volume expands beyond optimal thermal efficiency
    assert f_high.sor > f_med.sor


def test_css_uncertainty_quantification_bounds():
    """Verify that P10 <= P50 <= P90 strictly holds at every day of the forecast curve."""
    twin = CssTwinModel(n_monte_carlo=80, seed=42)
    params = CssParams(steam_volume_tonnes=1800.0, inj_pressure=140.0, soak_days=8.0, production_cutoff_water_cut=90.0)

    forecast, _ = twin.forecast(params)

    assert len(forecast.oil_rate_curve) > 0
    for pt in forecast.oil_rate_curve:
        assert pt.p10 <= pt.p50 <= pt.p90, f"Uncertainty order violated at day {pt.day}: {pt.p10} <= {pt.p50} <= {pt.p90}"

    assert forecast.band.p10 <= forecast.band.p50 <= forecast.band.p90


def test_css_determinism_with_seed():
    """Verify that identical seed produces identical forecast curves."""
    twin1 = CssTwinModel(n_monte_carlo=50, seed=123)
    twin2 = CssTwinModel(n_monte_carlo=50, seed=123)

    params = CssParams(steam_volume_tonnes=1500.0, inj_pressure=135.0, soak_days=7.0, production_cutoff_water_cut=90.0)
    f1, _ = twin1.forecast(params)
    f2, _ = twin2.forecast(params)

    assert f1.cum_oil == f2.cum_oil
    assert f1.sor == f2.sor
    assert [p.p50 for p in f1.oil_rate_curve] == [p.p50 for p in f2.oil_rate_curve]


def test_srp_mechanics_and_stress_monotonicity():
    """Verify SRP model behavior: longer stroke increases kW and rod stress."""
    srp = SrpTwinModel(seed=42)

    sp_short = SrpSetpoints(stroke_length=1.8, spm=4.5, vfd_hz=45.0)
    sp_long = SrpSetpoints(stroke_length=3.6, spm=4.5, vfd_hz=45.0)

    a_short, _ = srp.analyze(sp_short, viscosity_cp=150.0, inflow_liquid_bbl_day=500.0)
    a_long, _ = srp.analyze(sp_long, viscosity_cp=150.0, inflow_liquid_bbl_day=500.0)

    assert a_long.rod_stress_pct > a_short.rod_stress_pct
    assert a_long.k_w > a_short.k_w
    assert a_long.predicted_oil_rate > a_short.predicted_oil_rate


def test_srp_fluid_pound_and_rod_floating_detection():
    """Verify diagnosis and warnings trigger properly for mechanical hazard regimes."""
    srp = SrpTwinModel(seed=42)

    # 1. High viscosity + high SPM -> rod floating
    sp_float = SrpSetpoints(stroke_length=3.0, spm=6.5, vfd_hz=60.0)
    a_float, w_float = srp.analyze(sp_float, viscosity_cp=4500.0)
    assert a_float.dyno_card.diagnosis == "rod_floating"
    assert any("rod floating" in w.lower() for w in w_float)

    # 2. Inflow starved (low fillage) -> fluid pound
    sp_pound = SrpSetpoints(stroke_length=3.0, spm=5.0, vfd_hz=50.0)
    a_pound, w_pound = srp.analyze(sp_pound, viscosity_cp=80.0, inflow_liquid_bbl_day=15.0)
    assert a_pound.dyno_card.diagnosis == "fluid_pound"
    assert any("fluid pound" in w.lower() for w in w_pound)


def test_coupling_path1_css_to_srp():
    """
    Prove Coupling Path 1: Altering CSS steam volume changes post-steam viscosity,
    which demonstrably changes the SRP rod loads and failure risk.
    """
    css = CssTwinModel(n_monte_carlo=30, seed=42)
    srp = SrpTwinModel(seed=42)
    coupled = CoupledTwin(css, srp)

    sp = SrpSetpoints(stroke_length=2.8, spm=5.0, vfd_hz=50.0)

    # Low steam cycle: cool BHT -> high viscosity
    p_low_steam = CssParams(steam_volume_tonnes=600.0, inj_pressure=120.0, soak_days=8.0, production_cutoff_water_cut=90.0)
    _, srp_low, _ = coupled.evaluate_coupled_system(p_low_steam, sp)

    # High steam cycle: hot BHT -> low viscosity
    p_high_steam = CssParams(steam_volume_tonnes=2500.0, inj_pressure=140.0, soak_days=8.0, production_cutoff_water_cut=90.0)
    _, srp_high, _ = coupled.evaluate_coupled_system(p_high_steam, sp)

    # High steam thins the heavy crude, reducing drag and failure risk
    assert srp_low.failure_risk > srp_high.failure_risk
    # Surface load extrema should differ due to viscosity
    assert srp_low.rod_stress_pct != srp_high.rod_stress_pct


def test_coupling_path2_srp_to_css():
    """
    Prove Coupling Path 2: Altering SRP setpoints changes drawdown factor,
    which demonstrably changes the forward CSS oil rate curve.
    """
    css = CssTwinModel(n_monte_carlo=30, seed=42)
    srp = SrpTwinModel(seed=42)
    coupled = CoupledTwin(css, srp)

    css_p = CssParams(steam_volume_tonnes=1800.0, inj_pressure=140.0, soak_days=8.0, production_cutoff_water_cut=90.0)

    # Choked SRP pumping: low SPM & short stroke -> low drawdown
    srp_choked = SrpSetpoints(stroke_length=1.2, spm=2.0, vfd_hz=20.0)
    css_choked, _, _ = coupled.evaluate_coupled_system(css_p, srp_choked)

    # Optimal SRP pumping: aggressive stroke & optimal SPM -> strong drawdown
    srp_optimal = SrpSetpoints(stroke_length=3.0, spm=4.8, vfd_hz=48.0)
    css_optimal, _, _ = coupled.evaluate_coupled_system(css_p, srp_optimal)

    # Enhanced drawdown must increase the oil rate curve
    assert css_optimal.cum_oil > css_choked.cum_oil
    assert css_optimal.oil_rate_curve[0].p50 > css_choked.oil_rate_curve[0].p50


def test_setpoint_clamping_and_warnings():
    """Verify that out-of-bounds parameters produce warnings and are clamped, never accepted silently."""
    srp = SrpTwinModel(seed=42)
    sp_out_of_bounds = SrpSetpoints(stroke_length=4.4, spm=14.5, vfd_hz=68.0)  # Near extreme upper limits
    _analysis, warnings = srp.analyze(sp_out_of_bounds)

    assert len(warnings) > 0

    css = CssTwinModel(n_monte_carlo=20, seed=42)
    p_excess_pressure = CssParams(steam_volume_tonnes=1800.0, inj_pressure=220.0, soak_days=8.0, production_cutoff_water_cut=90.0)
    _, css_warn = css.forecast(p_excess_pressure)

    assert any("clamped" in w.lower() for w in css_warn)


def test_twin_measured_execution_time():
    """
    Measures the actual latency of the CSS and SRP what-if evaluations.
    Records the measured values without assuming arbitrary thresholds.
    """
    css = CssTwinModel(n_monte_carlo=50, seed=42)
    srp = SrpTwinModel(seed=42)

    p_css = CssParams(steam_volume_tonnes=1800.0, inj_pressure=140.0, soak_days=8.0, production_cutoff_water_cut=90.0)
    sp_srp = SrpSetpoints(stroke_length=2.8, spm=4.5, vfd_hz=45.0)

    # Measure CSS forecast latency
    t0 = time.perf_counter()
    _forecast, _ = css.forecast(p_css)
    t_css_ms = (time.perf_counter() - t0) * 1000.0

    # Measure SRP analysis latency
    t1 = time.perf_counter()
    _analysis, _ = srp.analyze(sp_srp)
    t_srp_ms = (time.perf_counter() - t1) * 1000.0

    print(f"\n[MEASURED TIMING] CSS Forecast (N=50 MC): {t_css_ms:.2f} ms | SRP Analysis: {t_srp_ms:.2f} ms")

    # Assert reasonable execution well within 200 ms target
    assert t_css_ms < 200.0
    assert t_srp_ms < 200.0
