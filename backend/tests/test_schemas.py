"""
Unit tests for Pydantic schemas contract and camelCase serialization.
"""
import pytest
from pydantic import ValidationError

from app.schemas import (
    CssForecast,
    CssParams,
    CssTelemetry,
    DecisionRequest,
    DerivedTelemetry,
    DynoCard,
    DynoPoint,
    ExpectedGain,
    JointBaseline,
    JointOptimized,
    JointResponse,
    OilRateCurvePoint,
    ParetoPoint,
    QualityTelemetry,
    RecoDriver,
    Recommendation,
    ReservoirTelemetry,
    SrpAnalysis,
    SrpSetpoints,
    SrpTelemetry,
    SurfaceTelemetry,
    Telemetry,
    UncertaintyBand,
    Well,
    WellboreTelemetry,
)


def test_well_schema():
    well = Well(
        id="BW-01",
        name="Baghewala-01",
        status="active",
        css_cycle_phase="production",
        cycle_number=4,
    )
    dump = well.model_dump(by_alias=True)
    assert dump["id"] == "BW-01"
    assert dump["name"] == "Baghewala-01"
    assert dump["cssCyclePhase"] == "production"
    assert dump["cycleNumber"] == 4


def test_telemetry_schema():
    tel = Telemetry(
        ts="2026-09-29T10:00:00Z",
        reservoir=ReservoirTelemetry(pressure=38.5, temperature=47.2),
        wellbore=WellboreTelemetry(bhp=22.1, bht=115.4, fluid_level=650.0, steam_quality=0.75),
        css=CssTelemetry(steam_rate=120.0, inj_pressure=145.0, cum_steam=1800.0, soak_day=0.0),
        srp=SrpTelemetry(
            stroke_length=3.0,
            spm=4.5,
            vfd_hz=45.0,
            rod_load_max=68.2,
            rod_load_min=18.4,
            motor_amps=24.5,
            k_w=18.2,
            pump_fillage_pct=88.5,
        ),
        surface=SurfaceTelemetry(
            wellhead_pressure=4.2,
            wellhead_temp=62.3,
            flow_rate=32.0,
            water_cut_pct=72.0,
            oil_rate=8.96,
        ),
        derived=DerivedTelemetry(sor=3.4, k_wh_per_bbl=48.5),
        quality=QualityTelemetry(tag_status={"bhp": "ok", "rodLoad": "ok"}, data_age_sec=1.8),
    )
    dump = tel.model_dump(by_alias=True)
    assert dump["srp"]["kW"] == 18.2
    assert dump["srp"]["rodLoadMax"] == 68.2
    assert dump["srp"]["pumpFillagePct"] == 88.5
    assert dump["derived"]["sor"] == 3.4
    assert dump["derived"]["kWhPerBbl"] == 48.5
    assert dump["quality"]["tagStatus"]["bhp"] == "ok"


def test_dyno_card_schema():
    card = DynoCard(
        surface=[DynoPoint(position=0.0, load=15.0), DynoPoint(position=2.0, load=65.0)],
        downhole=[DynoPoint(position=0.0, load=20.0), DynoPoint(position=1.8, load=55.0)],
        diagnosis="rod_floating",
        confidence=0.92,
    )
    dump = card.model_dump(by_alias=True)
    assert dump["diagnosis"] == "rod_floating"
    assert dump["confidence"] == 0.92
    assert len(dump["surface"]) == 2


def test_css_params_and_forecast_schema():
    params = CssParams(
        steam_volume_tonnes=2000.0,
        inj_pressure=140.0,
        soak_days=10.0,
        production_cutoff_water_cut=90.0,
    )
    forecast = CssForecast(
        params=params,
        oil_rate_curve=[OilRateCurvePoint(day=1, p10=22.0, p50=25.0, p90=28.0)],
        cum_oil=480.0,
        sor=4.16,
        energy_cost=12500.0,
        band=UncertaintyBand(p10=420.0, p50=480.0, p90=540.0),
    )
    dump = forecast.model_dump(by_alias=True)
    assert dump["params"]["steamVolumeTonnes"] == 2000.0
    assert dump["oilRateCurve"][0]["p50"] == 25.0
    assert dump["cumOil"] == 480.0


def test_srp_setpoints_and_analysis_schema():
    setpoints = SrpSetpoints(stroke_length=2.8, spm=5.0, vfd_hz=50.0)
    card = DynoCard(
        surface=[DynoPoint(position=0.0, load=12.0)],
        downhole=[DynoPoint(position=0.0, load=14.0)],
        diagnosis="normal",
        confidence=0.95,
    )
    analysis = SrpAnalysis(
        setpoints=setpoints,
        predicted_oil_rate=14.2,
        rod_stress_pct=72.5,
        k_w=15.8,
        failure_risk=0.12,
        dyno_card=card,
        warnings=[],
    )
    dump = analysis.model_dump(by_alias=True)
    assert dump["setpoints"]["strokeLength"] == 2.8
    assert dump["predictedOilRate"] == 14.2
    assert dump["kW"] == 15.8
    assert dump["rodStressPct"] == 72.5


def test_recommendation_and_decision_schema():
    reco = Recommendation(
        id="REC-001",
        well_id="BW-02",
        type="joint",
        current={"spm": 6.5, "steamVolumeTonnes": 1500},
        proposed={"spm": 4.2, "steamVolumeTonnes": 1800},
        expected_gain=ExpectedGain(oil_bbl_per_day=3.8, sor_delta=-0.45, k_wh_delta=-6.2),
        risk_score=0.22,
        confidence=0.88,
        reasoning=["Lowering SPM mitigates rod floating while higher steam quality enhances drawdown"],
        drivers=[RecoDriver(feature="fluid_viscosity", contribution=0.42)],
        status="pending",
        created_at="2026-09-29T10:00:00Z",
    )
    dump = reco.model_dump(by_alias=True)
    assert dump["wellId"] == "BW-02"
    assert dump["expectedGain"]["oilBblPerDay"] == 3.8
    assert dump["expectedGain"]["kWhDelta"] == -6.2
    assert dump["drivers"][0]["feature"] == "fluid_viscosity"

    # Decision request requires reason
    with pytest.raises(ValidationError):
        DecisionRequest(decision="accepted", reason="")

    req = DecisionRequest(decision="accepted", reason="Approved per reservoir engineer review")
    assert req.reason == "Approved per reservoir engineer review"


def test_joint_response_schema():
    css_p = CssParams(
        steam_volume_tonnes=1800.0,
        inj_pressure=135.0,
        soak_days=8.0,
        production_cutoff_water_cut=90.0,
    )
    srp_sp = SrpSetpoints(stroke_length=2.5, spm=4.0, vfd_hz=40.0)

    base = JointBaseline(
        css_params=css_p,
        srp_setpoints=srp_sp,
        oil_rate=12.0,
        sor=4.5,
        k_wh_per_bbl=52.0,
        rod_stress_pct=78.0,
        failure_risk=0.28,
    )
    opt = JointOptimized(
        css_params=css_p,
        srp_setpoints=srp_sp,
        oil_rate=14.5,
        sor=3.8,
        k_wh_per_bbl=44.0,
        rod_stress_pct=65.0,
        failure_risk=0.14,
        oil_uplift_pct=20.8,
        sor_reduction_pct=15.5,
        energy_saving_pct=15.4,
    )
    resp = JointResponse(
        baseline_separate=base,
        joint_optimized=opt,
        pareto=[ParetoPoint(oil=14.5, energy=44.0, risk=0.14, css_params=css_p, srp_setpoints=srp_sp)],
    )
    dump = resp.model_dump(by_alias=True)
    assert dump["baselineSeparate"]["kWhPerBbl"] == 52.0
    assert dump["jointOptimized"]["oilUpliftPct"] == 20.8
    assert len(dump["pareto"]) == 1
