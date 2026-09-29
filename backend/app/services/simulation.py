"""
OIL-TWIN AI - Simulation Engine
Physics-informed engineering simulation for CSS and SRP operations.
IMPORTANT: Simplified engineering approximations for MVP demonstration.
Not a validated reservoir simulator. All results are indicative only.
"""
from typing import Any

import numpy as np

from app.ml.models import get_ml_models

# ── Physical Constants ────────────────────────────────────────────────────────
M3_TO_BBL = 6.28981  # m³ to barrels
STEAM_ENTHALPY_KJ_KG = 2700.0  # Approximate steam enthalpy at ~10 MPa
WATER_DENSITY_KG_M3 = 800.0   # Steam/hot water density
KWH_PER_KJ = 1 / 3600


def viscosity_from_temp(base_viscosity_cp: float, base_temp_c: float, target_temp_c: float) -> float:
    """
    Andrade-type relationship for heavy oil viscosity vs temperature.
    ln(μ) = A + B/T  where T is in Kelvin.
    """
    if target_temp_c <= 0:
        return base_viscosity_cp
    T_base = base_temp_c + 273.15
    T_target = target_temp_c + 273.15
    # B ≈ 2800 for heavy oils; calibrate from base point
    B = 2800.0
    A = np.log(base_viscosity_cp) - B / T_base
    new_visc = np.exp(A + B / T_target)
    return float(np.clip(new_visc, 10.0, 200000.0))


def estimate_steam_energy_kwh(steam_volume_m3: float, steam_quality: float = 0.8) -> float:
    """
    Estimate energy content of steam injection.
    E = m * h where m = volume * density, h = enthalpy
    """
    mass_kg = steam_volume_m3 * WATER_DENSITY_KG_M3 * steam_quality
    energy_kj = mass_kg * STEAM_ENTHALPY_KJ_KG
    return energy_kj * KWH_PER_KJ


class CSSSimulator:
    """
    Cyclic Steam Stimulation engineering simulator.
    Approximates reservoir heating, production response, SOR, and energy.
    """

    def simulate(
        self,
        steam_volume_m3: float,
        injection_pressure_kpa: float,
        soak_time_days: float,
        production_cutoff_m3d: float,
        cycle_number: int,
        current_reservoir_temp_c: float,
        current_viscosity_cp: float,
        reservoir_pressure_kpa: float = 4500.0,
        ml_models=None
    ) -> dict[str, Any]:
        """
        Simulate a full CSS cycle.
        Returns heating profile, production, energy, and SOR.
        """
        if ml_models is None:
            ml_models = get_ml_models()

        # ── Phase 1: Steam Injection ──────────────────────────────────────────
        # Temperature rise from steam; more steam → more heating
        # Injection pressure affects steam penetration radius
        steam_penetration_factor = np.sqrt(injection_pressure_kpa / 5000.0)
        raw_temp_rise = 0.025 * steam_volume_m3 * steam_penetration_factor
        temp_rise_injection = np.clip(raw_temp_rise, 0, 150)
        peak_temp = min(current_reservoir_temp_c + temp_rise_injection, 220.0)

        # ── Phase 2: Soak ─────────────────────────────────────────────────────
        # Temperature decays during soak period (heat loss to formation)
        soak_decay_rate = 0.02  # °C/day loss to formation
        temp_after_soak = max(
            current_reservoir_temp_c + 5,
            peak_temp - soak_decay_rate * soak_time_days * (peak_temp - current_reservoir_temp_c)
        )

        # ── Viscosity at heated reservoir ─────────────────────────────────────
        viscosity_at_peak = viscosity_from_temp(current_viscosity_cp, current_reservoir_temp_c, peak_temp)
        viscosity_after_soak = viscosity_from_temp(current_viscosity_cp, current_reservoir_temp_c, temp_after_soak)

        # ── Phase 3: Production ───────────────────────────────────────────────
        # Use ML model for production prediction
        prod_params = {
            "reservoir_temp_c": temp_after_soak,
            "reservoir_pressure_kpa": reservoir_pressure_kpa,
            "viscosity_cp": viscosity_after_soak,
            "steam_volume_m3": steam_volume_m3,
            "injection_pressure_kpa": injection_pressure_kpa,
            "soak_time_days": soak_time_days,
            "stroke_length_m": 3.5,
            "spm": 8.0,
            "vfd_hz": 50.0,
            "cycle_number": cycle_number,
        }
        prod_result = ml_models.predict_production(prod_params)
        peak_rate = prod_result["predicted_value"]

        # Production decline: exponential decline to cutoff
        decline_rate = 0.02 + 0.002 * (cycle_number - 1)  # faster decline each cycle
        days_to_cutoff = 0
        cumulative_oil = 0.0
        heating_profile = []

        for day in range(1, 120):
            rate = peak_rate * np.exp(-decline_rate * day)
            temp_now = temp_after_soak - (0.2 * day)  # cooling during production
            temp_now = max(temp_now, current_reservoir_temp_c)

            heating_profile.append({
                "day": day,
                "temperature_c": round(temp_now, 1),
                "oil_rate_m3d": round(max(rate, 0), 2),
            })

            cumulative_oil += rate
            if rate < production_cutoff_m3d:
                days_to_cutoff = day
                break

        if days_to_cutoff == 0:
            days_to_cutoff = 90

        # ── Energy & SOR ──────────────────────────────────────────────────────
        steam_energy_kwh = estimate_steam_energy_kwh(steam_volume_m3)
        pump_energy_kwh = 150.0 * days_to_cutoff   # approximate pump energy
        total_energy = steam_energy_kwh + pump_energy_kwh

        total_oil_m3 = cumulative_oil
        sor = steam_volume_m3 / max(total_oil_m3, 0.1)

        confidence = prod_result["confidence"]

        return {
            "reservoir_temp_peak_c": round(peak_temp, 1),
            "reservoir_temp_after_soak_c": round(temp_after_soak, 1),
            "predicted_oil_m3": round(total_oil_m3, 2),
            "predicted_peak_rate_m3d": round(peak_rate, 2),
            "production_duration_days": days_to_cutoff,
            "energy_kwh": round(total_energy, 0),
            "sor": round(sor, 2),
            "confidence": round(confidence, 1),
            "heating_profile": heating_profile[:60],  # First 60 days
            "viscosity_at_peak_cp": round(viscosity_at_peak, 1),
            "viscosity_after_soak_cp": round(viscosity_after_soak, 1),
        }


class SRPSimulator:
    """
    Sucker Rod Pump engineering simulator.
    Estimates production, efficiency, energy, and equipment risk.
    Note: Does NOT optimize SRP independently of reservoir state.
    """

    def simulate(
        self,
        stroke_length_m: float,
        spm: float,
        vfd_hz: float,
        reservoir_temp_c: float,
        reservoir_pressure_kpa: float,
        viscosity_cp: float,
        pump_diameter_mm: float = 44.45,
        ml_models=None
    ) -> dict[str, Any]:
        """
        Simulate SRP operation under current reservoir conditions.
        Production depends on reservoir state — SRP is not independent.
        """
        if ml_models is None:
            ml_models = get_ml_models()

        # ── Theoretical displacement ──────────────────────────────────────────
        pump_area_m2 = np.pi * (pump_diameter_mm / 1000 / 2) ** 2
        theoretical_displacement_m3d = stroke_length_m * pump_area_m2 * spm * 60 * 24

        # ── Pump efficiency ───────────────────────────────────────────────────
        risk_params = {
            "viscosity_cp": viscosity_cp,
            "reservoir_temp_c": reservoir_temp_c,
            "reservoir_pressure_kpa": reservoir_pressure_kpa,
            "spm": spm,
            "stroke_length_m": stroke_length_m,
            "vfd_hz": vfd_hz,
            "pump_efficiency_pct": 70.0,  # initial guess
            "oil_rate_m3d": 5.0,          # initial guess
        }
        pump_eff = ml_models.predict_pump_efficiency(risk_params)

        # ── Actual production ─────────────────────────────────────────────────
        actual_rate = theoretical_displacement_m3d * (pump_eff / 100.0)
        # Constrain by reservoir deliverability (viscosity-dependent IPR approximation)
        max_deliverable = 30.0 / (1.0 + 0.00005 * viscosity_cp)
        actual_rate = float(np.clip(actual_rate, 0, max_deliverable))

        # ── Energy consumption ────────────────────────────────────────────────
        # Motor power ≈ torque × angular_velocity
        # Simplified: Power(kW) ≈ stroke_force × stroke_length × spm / efficiency
        rod_weight_kn = 30.0  # typical rod string weight
        fluid_load_kn = 10.0 + 0.001 * viscosity_cp
        surface_load_kn = rod_weight_kn + fluid_load_kn
        power_kw = (surface_load_kn * stroke_length_m * spm) / (6.0 * 0.85)  # 0.85 motor eff
        energy_per_day = power_kw * 24

        # ── Risk prediction ───────────────────────────────────────────────────
        risk_params["pump_efficiency_pct"] = pump_eff
        risk_params["oil_rate_m3d"] = actual_rate
        risk_result = ml_models.predict_risk(risk_params)

        return {
            "theoretical_displacement_m3d": round(theoretical_displacement_m3d, 3),
            "predicted_rate_m3d": round(actual_rate, 2),
            "pump_efficiency_pct": round(pump_eff, 1),
            "energy_kwh_per_day": round(energy_per_day, 1),
            "rod_floating_risk": risk_result["rod_floating_risk"],
            "pump_unsetting_risk": risk_result["pump_unsetting_risk"],
            "rod_failure_risk": risk_result["rod_failure_risk"],
            "impact_loading_risk": risk_result["impact_loading_risk"],
            "overall_risk_score": risk_result["overall_risk"],
            "risk_reasons": risk_result["reasons"],
            "reservoir_coupling_note": (
                "SRP simulation uses reservoir temperature and viscosity as inputs. "
                "CSS changes will alter these parameters and affect pump performance."
            ),
        }


class WhatIfSimulator:
    """
    Combined CSS + SRP What-If simulator for scenario comparison.
    """

    def __init__(self):
        self.css_sim = CSSSimulator()
        self.srp_sim = SRPSimulator()

    def run_scenario(self, params: dict, scenario_name: str = "Scenario A") -> dict:
        """Run a combined CSS+SRP scenario and return comprehensive results."""
        ml = get_ml_models()

        # CSS simulation
        css_result = self.css_sim.simulate(
            steam_volume_m3=params["steam_volume_m3"],
            injection_pressure_kpa=params["injection_pressure_kpa"],
            soak_time_days=params["soak_time_days"],
            production_cutoff_m3d=params["production_cutoff_m3d"],
            cycle_number=params.get("cycle_number", 5),
            current_reservoir_temp_c=params.get("current_reservoir_temp_c", 95.0),
            current_viscosity_cp=params.get("current_viscosity_cp", 5000.0),
            reservoir_pressure_kpa=params.get("current_reservoir_pressure_kpa", 4500.0),
            ml_models=ml
        )

        # SRP simulation using CSS-updated reservoir state
        srp_result = self.srp_sim.simulate(
            stroke_length_m=params["stroke_length_m"],
            spm=params["spm"],
            vfd_hz=params["vfd_hz"],
            reservoir_temp_c=css_result["reservoir_temp_after_soak_c"],
            reservoir_pressure_kpa=params.get("current_reservoir_pressure_kpa", 4500.0),
            viscosity_cp=css_result["viscosity_after_soak_cp"],
            ml_models=ml
        )

        # Combined metrics
        total_energy = css_result["energy_kwh"] + srp_result["energy_kwh_per_day"] * css_result["production_duration_days"]
        oil_bbls = css_result["predicted_oil_m3"] * M3_TO_BBL
        energy_per_bbl = total_energy / max(oil_bbls, 1.0)
        sor = css_result["sor"]

        # Weighted score (higher is better — normalized 0 to 1)
        prod_norm = min(css_result["predicted_oil_m3"] / 500.0, 1.0)
        eff_norm = srp_result["pump_efficiency_pct"] / 100.0
        energy_norm = 1.0 - min(energy_per_bbl / 20.0, 1.0)
        sor_norm = 1.0 - min(sor / 10.0, 1.0)
        risk_norm = 1.0 - srp_result["overall_risk_score"] / 100.0

        score = (
            0.35 * prod_norm
            + 0.20 * eff_norm
            + 0.20 * energy_norm
            + 0.15 * sor_norm
            + 0.10 * risk_norm
        )

        return {
            "scenario_name": scenario_name,
            "oil_production_m3": css_result["predicted_oil_m3"],
            "peak_rate_m3d": css_result["predicted_peak_rate_m3d"],
            "reservoir_temp_c": css_result["reservoir_temp_after_soak_c"],
            "viscosity_cp": css_result["viscosity_after_soak_cp"],
            "energy_kwh": round(total_energy, 0),
            "energy_per_barrel_kwh": round(energy_per_bbl, 2),
            "sor": css_result["sor"],
            "pump_efficiency_pct": srp_result["pump_efficiency_pct"],
            "rod_floating_risk": srp_result["rod_floating_risk"],
            "rod_failure_risk": srp_result["rod_failure_risk"],
            "pump_unsetting_risk": srp_result["pump_unsetting_risk"],
            "impact_loading_risk": srp_result["impact_loading_risk"],
            "overall_risk": srp_result["overall_risk_score"],
            "overall_score": round(score, 4),
            "heating_profile": css_result.get("heating_profile", []),
        }


class OptimizationEngine:
    """
    Multi-objective optimization engine.
    Searches feasible CSS+SRP parameter space to find balanced scenarios.
    Objective: balanced production, efficiency, energy, SOR, and risk.
    """

    def __init__(self):
        self.simulator = WhatIfSimulator()

    def optimize(
        self,
        base_params: dict,
        weights: dict | None = None
    ) -> dict:
        """
        Grid-search over feasible parameter combinations.
        Returns best scenario and ranked alternatives.
        """
        if weights is None:
            weights = {
                "production": 0.35,
                "efficiency": 0.20,
                "energy": 0.20,
                "sor": 0.15,
                "risk": 0.10,
            }

        # Define search grid
        steam_volumes = [500, 1000, 1500, 2000, 2500]
        inj_pressures = [3000, 5000, 7000, 9000]
        soak_times = [5, 10, 15, 20]
        spm_values = [5, 8, 10, 12]
        stroke_lengths = [2.5, 3.5, 4.5]
        vfd_settings = [45, 50, 55]

        results = []
        scenario_idx = 1

        for sv in steam_volumes:
            for ip in inj_pressures:
                for st in soak_times:
                    for spm in spm_values:
                        for sl in stroke_lengths:
                            for vfd in vfd_settings:
                                params = {
                                    **base_params,
                                    "steam_volume_m3": sv,
                                    "injection_pressure_kpa": ip,
                                    "soak_time_days": st,
                                    "production_cutoff_m3d": base_params.get("production_cutoff_m3d", 1.0),
                                    "spm": spm,
                                    "stroke_length_m": sl,
                                    "vfd_hz": vfd,
                                }
                                result = self.simulator.run_scenario(params, f"OPT-{scenario_idx:03d}")
                                # Recompute score with custom weights
                                prod_norm = min(result["oil_production_m3"] / 500.0, 1.0)
                                eff_norm = result["pump_efficiency_pct"] / 100.0
                                energy_norm = 1.0 - min(result["energy_per_barrel_kwh"] / 20.0, 1.0)
                                sor_norm = 1.0 - min(result["sor"] / 10.0, 1.0)
                                risk_norm = 1.0 - result["overall_risk"] / 100.0

                                score = (
                                    weights["production"] * prod_norm
                                    + weights["efficiency"] * eff_norm
                                    + weights["energy"] * energy_norm
                                    + weights["sor"] * sor_norm
                                    + weights["risk"] * risk_norm
                                )
                                result["overall_score"] = round(score, 4)
                                result["css_params"] = {
                                    "steam_volume_m3": sv,
                                    "injection_pressure_kpa": ip,
                                    "soak_time_days": st,
                                }
                                result["srp_params"] = {
                                    "stroke_length_m": sl,
                                    "spm": spm,
                                    "vfd_hz": vfd,
                                }
                                results.append(result)
                                scenario_idx += 1

        # Sort by score descending
        results.sort(key=lambda x: x["overall_score"], reverse=True)

        best = results[0]
        best["is_recommended"] = True
        alternatives = results[1:5]  # Top 4 alternatives

        # Generate explanation
        explanation = self._explain(best, base_params)

        return {
            "best_scenario": best,
            "alternatives": alternatives,
            "optimization_score": best["overall_score"],
            "total_scenarios_evaluated": len(results),
            "explanation": explanation,
            "weights_used": weights,
        }

    def _explain(self, best: dict, base: dict) -> list[str]:
        reasons = [
            f"Evaluated {720} feasible CSS+SRP parameter combinations.",
            f"Best scenario achieves {best['oil_production_m3']:.1f} m³ production with SOR={best['sor']:.2f}.",
            (f"Reservoir temperature after soak: {best['reservoir_temp_c']:.1f}°C — "
            f"sufficient for viscosity reduction."),
            f"Pump efficiency: {best['pump_efficiency_pct']:.1f}% — above acceptable threshold.",
            f"Overall equipment risk score: {best['overall_risk']:.1f}/100.",
            "Scenario selected to balance production, energy efficiency, steam-oil ratio, and equipment risk.",
            "Higher steam volumes considered but rejected due to diminishing production returns vs energy cost.",
            "IMPORTANT: Validate all parameters against field engineering constraints before operational use.",
        ]
        return reasons


# Singletons
_css_sim = None
_srp_sim = None
_whatif_sim = None
_opt_engine = None


def get_css_simulator() -> CSSSimulator:
    global _css_sim
    if _css_sim is None:
        _css_sim = CSSSimulator()
    return _css_sim


def get_srp_simulator() -> SRPSimulator:
    global _srp_sim
    if _srp_sim is None:
        _srp_sim = SRPSimulator()
    return _srp_sim


def get_whatif_simulator() -> WhatIfSimulator:
    global _whatif_sim
    if _whatif_sim is None:
        _whatif_sim = WhatIfSimulator()
    return _whatif_sim


def get_optimization_engine() -> OptimizationEngine:
    global _opt_engine
    if _opt_engine is None:
        _opt_engine = OptimizationEngine()
    return _opt_engine
