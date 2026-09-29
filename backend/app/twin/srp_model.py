"""
OIL-TWIN AI - Sucker Rod Pump (SRP) Physics Twin Model
Evaluates operational setpoints (stroke length, SPM, VFD frequency) against:
1. Dynamic pump fillage and fluid pound onset
2. Viscous drag and rod-floating threshold
3. Modified Goodman cyclic stress limits
4. Power demand (kW) and motor amperage
5. Vectorized dyno card generation (NumPy)
"""
import math

import numpy as np

from app.config.assumptions import FIELD_ASSUMPTIONS
from app.schemas.dyno import DynoCard
from app.schemas.srp import SrpAnalysis, SrpSetpoints
from app.simulator.srp_mechanics import (
    compute_srp_electromechanics,
    compute_vectorized_dyno_card,
    evaluate_srp_condition,
)


class SrpTwinModel:
    """Surrogate SRP model evaluating mechanical integrity, dyno cards, and production rates."""

    def __init__(self, seed: int = 42):
        self.seed = seed
        self.rng = np.random.RandomState(seed)

    def analyze(
        self,
        setpoints: SrpSetpoints,
        viscosity_cp: float = 180.0,
        fluid_level_m: float = 550.0,
        inflow_liquid_bbl_day: float = 120.0,
        water_cut_pct: float = 75.0,
    ) -> tuple[SrpAnalysis, list[str]]:
        """
        Evaluates SRP operation under current wellbore and fluid conditions.
        Returns (SrpAnalysis, warnings).
        """
        warnings = []
        stroke_s = setpoints.stroke_length
        spm_val = setpoints.spm
        vfd_hz_val = setpoints.vfd_hz

        # Constraint clamping and warnings
        s_min = FIELD_ASSUMPTIONS.srp.stroke_length_min_m
        s_max = FIELD_ASSUMPTIONS.srp.stroke_length_max_m
        if stroke_s < s_min or stroke_s > s_max:
            clamped_s = max(s_min, min(s_max, stroke_s))
            warnings.append(
                f"Stroke length {stroke_s} m is outside recommended operating envelope [{s_min}, {s_max}] m; clamped to {clamped_s} m."
            )
            stroke_s = clamped_s

        spm_min = FIELD_ASSUMPTIONS.srp.spm_min
        spm_max = FIELD_ASSUMPTIONS.srp.spm_max
        if spm_val < spm_min or spm_val > spm_max:
            clamped_spm = max(spm_min, min(spm_max, spm_val))
            warnings.append(
                f"SPM {spm_val} is outside mechanical envelope [{spm_min}, {spm_max}]; clamped to {clamped_spm}."
            )
            spm_val = clamped_spm

        # VFD frequency sync check: standard gear ratio links 50 Hz to ~5.0 SPM
        expected_spm = (vfd_hz_val / 50.0) * 5.0
        if abs(spm_val - expected_spm) > 2.5:
            warnings.append(
                f"VFD frequency ({vfd_hz_val} Hz) is mismatched with target SPM ({spm_val}); gear ratio slip or torque limitation."
            )

        # 1. Pump displacement & fillage %
        plunger_d_m = FIELD_ASSUMPTIONS.srp.plunger_diameter_mm / 1000.0
        a_plunger_m2 = math.pi * (plunger_d_m / 2.0) ** 2
        # Displacement in m3/day
        disp_m3_day = a_plunger_m2 * stroke_s * spm_val * 1440.0
        disp_bbl_day = disp_m3_day * FIELD_ASSUMPTIONS.economics.bbl_per_m3

        # Inflow capacity limits fillage
        fillage_pct = min(98.0, max(25.0, (inflow_liquid_bbl_day / max(1.0, disp_bbl_day)) * 100.0))

        # 2. Condition evaluation
        diagnosis, confidence = evaluate_srp_condition(
            viscosity_cp=viscosity_cp,
            spm=spm_val,
            stroke_length_m=stroke_s,
            pump_fillage_pct=fillage_pct,
            fluid_level_m=fluid_level_m,
        )

        if diagnosis == "rod_floating":
            warnings.append(
                f"Critical risk: Heavy oil viscosity ({viscosity_cp:.0f} cP) with {spm_val} SPM causes rod floating on downstroke."
            )
        elif diagnosis == "fluid_pound":
            warnings.append(
                f"Warning: Low pump fillage ({fillage_pct:.1f}%) induces severe fluid pound shock loading."
            )

        # 3. Vectorized dyno card generation (NumPy)
        surface_pts, downhole_pts, r_max_kn, r_min_kn = compute_vectorized_dyno_card(
            diagnosis=diagnosis,
            stroke_length_m=stroke_s,
            spm=spm_val,
            viscosity_cp=viscosity_cp,
            pump_fillage_pct=fillage_pct,
            pump_depth_m=FIELD_ASSUMPTIONS.srp.pump_depth_m,
            rng=self.rng,
        )

        dyno_card = DynoCard(
            surface=surface_pts,
            downhole=downhole_pts,
            diagnosis=diagnosis,
            confidence=confidence,
        )

        # 4. Electromechanics & stress
        kw, _motor_amps, rod_stress_pct = compute_srp_electromechanics(
            rod_load_max_kn=r_max_kn,
            rod_load_min_kn=r_min_kn,
            stroke_length_m=stroke_s,
            spm=spm_val,
            vfd_hz=vfd_hz_val,
        )

        if rod_stress_pct > FIELD_ASSUMPTIONS.srp.max_allowable_stress_pct:
            warnings.append(
                f"Rod stress at {rod_stress_pct:.1f}% exceeds safe Goodman limit ({FIELD_ASSUMPTIONS.srp.max_allowable_stress_pct}%)."
            )

        # 5. Production rate
        actual_liquid_bbl = disp_bbl_day * (fillage_pct / 100.0)
        oil_rate_bbl = actual_liquid_bbl * max(0.01, (100.0 - water_cut_pct) / 100.0)

        # 6. Failure probability (fatigue cycles, stress level, floating/pound shocks, viscous drag)
        base_risk = 0.05
        stress_risk = max(0.0, (rod_stress_pct - 65.0) / 45.0) * 0.45
        shock_risk = 0.35 if diagnosis in ("rod_floating", "fluid_pound", "tagging") else 0.0
        visc_risk = min(0.35, (viscosity_cp / 1500.0) * 0.12)
        total_failure_risk = min(0.99, max(0.02, base_risk + stress_risk + shock_risk + visc_risk))

        analysis = SrpAnalysis(
            setpoints=setpoints,
            predicted_oil_rate=round(float(oil_rate_bbl), 1),
            rod_stress_pct=round(float(rod_stress_pct), 1),
            k_w=round(float(kw), 2),
            failure_risk=round(float(total_failure_risk), 2),
            dyno_card=dyno_card,
            warnings=warnings,
        )

        return analysis, warnings
