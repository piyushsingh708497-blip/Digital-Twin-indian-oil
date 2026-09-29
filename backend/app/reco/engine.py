"""
OIL-TWIN AI - Recommendation Engine
Generates advisory CSS, SRP, and Joint recommendations with:
1. Explainable natural language reasoning
2. Ranked physical and ML feature drivers (SHAP / Tree importances)
3. Quantified expected gains (oilBblPerDay, sorDelta, kWhDelta)
4. Human-in-the-loop governance: NEVER automatically applied
"""
from datetime import datetime, timezone

from app.ml.explainers import TwinExplainer
from app.optimizer.joint_optimizer import JointOptimizer
from app.reco.templates import format_joint_reasoning, format_srp_reasoning
from app.schemas.css import CssParams
from app.schemas.meta import WellStateResponse
from app.schemas.reco import ExpectedGain, Recommendation
from app.schemas.srp import SrpSetpoints
from app.twin.coupling import CoupledTwin


class RecommendationEngine:
    """Evaluates well operating telemetry and synthesizes advisory recommendations."""

    def __init__(self, coupled_twin: CoupledTwin):
        self.twin = coupled_twin
        self.optimizer = JointOptimizer(coupled_twin)
        self.explainer = TwinExplainer()

    def generate_recommendations(
        self,
        well_state: WellStateResponse,
    ) -> list[Recommendation]:
        """Generates advisory recommendations for a monitored well."""
        recos: list[Recommendation] = []
        well_id = well_state.well_id
        tel = well_state.telemetry
        dyno = well_state.dyno_card

        now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

        current_css = CssParams(
            steam_volume_tonnes=max(500.0, tel.css.cum_steam) if tel.css.cum_steam > 0 else 1800.0,
            inj_pressure=140.0,
            soak_days=tel.css.soak_day if tel.css.soak_day > 0 else 8.0,
            production_cutoff_water_cut=90.0,
        )
        current_srp = SrpSetpoints(
            stroke_length=tel.srp.stroke_length if tel.srp.stroke_length > 0 else 2.8,
            spm=tel.srp.spm if tel.srp.spm > 0 else 4.5,
            vfd_hz=tel.srp.vfd_hz if tel.srp.vfd_hz > 0 else 45.0,
        )

        # 1. SRP RECOMMENDATION (e.g. for rod floating on BW-03 or high stress)
        if dyno.diagnosis == "rod_floating" or tel.srp.spm > 6.0:
            proposed_srp = SrpSetpoints(
                stroke_length=2.8,
                spm=4.2,  # De-rate SPM to prevent floating
                vfd_hz=42.0,
            )
            oil_visc = 4500.0
            srp_eval, _ = self.twin.srp_twin.analyze(
                proposed_srp,
                viscosity_cp=oil_visc,
                fluid_level_m=tel.wellbore.fluid_level,
            )

            current_dict = {
                "spm": current_srp.spm,
                "strokeLength": current_srp.stroke_length,
                "vfdHz": current_srp.vfd_hz,
                "diagnosis": dyno.diagnosis,
                "viscosityCp": 4500.0,
            }
            proposed_dict = {
                "spm": proposed_srp.spm,
                "strokeLength": proposed_srp.stroke_length,
                "vfdHz": proposed_srp.vfd_hz,
                "diagnosis": srp_eval.dyno_card.diagnosis,
            }

            reasons = format_srp_reasoning(
                current_spm=current_srp.spm,
                proposed_spm=proposed_srp.spm,
                viscosity_cp=4500.0,
                diagnosis=dyno.diagnosis,
                stress_pct=srp_eval.rod_stress_pct,
            )

            drivers = self.explainer.explain_recommendation_drivers(
                current_dict, proposed_dict, reco_type="srp"
            )

            recos.append(
                Recommendation(
                    id=f"REC-SRP-{well_id}",
                    well_id=well_id,
                    type="srp",
                    current=current_dict,
                    proposed=proposed_dict,
                    expected_gain=ExpectedGain(
                        oil_bbl_per_day=round(float(srp_eval.predicted_oil_rate - tel.surface.oil_rate), 1),
                        sor_delta=0.0,
                        kWhDelta=-4.5,
                    ),
                    risk_score=0.18,
                    confidence=0.92,
                    reasoning=reasons,
                    drivers=drivers,
                    status="pending",
                    created_at=now_iso,
                )
            )

        # 2. JOINT RECOMMENDATION (coupled CSS + SRP optimization)
        joint_res = self.optimizer.optimize_well(
            well_id=well_id,
            current_css=current_css,
            current_srp=current_srp,
            current_res_temp_c=tel.reservoir.temperature,
        )

        opt = joint_res.joint_optimized
        oil_gain = opt.oil_rate - joint_res.baseline_separate.oil_rate
        sor_gain = opt.sor - joint_res.baseline_separate.sor
        energy_gain = opt.k_wh_per_bbl - joint_res.baseline_separate.k_wh_per_bbl

        curr_joint_dict = {
            "steamVolumeTonnes": current_css.steam_volume_tonnes,
            "soakDays": current_css.soak_days,
            "strokeLength": current_srp.stroke_length,
            "spm": current_srp.spm,
            "oilRate": joint_res.baseline_separate.oil_rate,
            "sor": joint_res.baseline_separate.sor,
        }
        prop_joint_dict = {
            "steamVolumeTonnes": opt.css_params.steam_volume_tonnes,
            "soakDays": opt.css_params.soak_days,
            "strokeLength": opt.srp_setpoints.stroke_length,
            "spm": opt.srp_setpoints.spm,
            "oilRate": opt.oil_rate,
            "sor": opt.sor,
        }

        joint_drivers = self.explainer.explain_recommendation_drivers(
            curr_joint_dict, prop_joint_dict, reco_type="joint"
        )
        primary = joint_drivers[0].feature if joint_drivers else "synchronized_drawdown"

        recos.append(
            Recommendation(
                id=f"REC-JNT-{well_id}",
                well_id=well_id,
                type="joint",
                current=curr_joint_dict,
                proposed=prop_joint_dict,
                expected_gain=ExpectedGain(
                    oil_bbl_per_day=round(float(oil_gain), 1),
                    sor_delta=round(float(sor_gain), 2),
                    kWhDelta=round(float(energy_gain), 1),
                ),
                risk_score=round(float(opt.failure_risk), 2),
                confidence=0.89,
                reasoning=format_joint_reasoning(oil_gain, sor_gain, energy_gain, primary),
                drivers=joint_drivers,
                status="pending",
                created_at=now_iso,
            )
        )

        return recos
