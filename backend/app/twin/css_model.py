"""
OIL-TWIN AI - Cyclic Steam Stimulation (CSS) Physics Twin Model
Surrogate decline model (Boberg-Lundberg thermal scavenge formulation):
1. Monte Carlo uncertainty quantification (P10, P50, P90)
2. Diminishing returns with increasing steam volume
3. Heat-wasting penalty for excessive soak time
4. Vectorized execution in NumPy with deterministic seeding
"""
import math

import numpy as np

from app.config.assumptions import FIELD_ASSUMPTIONS
from app.schemas.css import (
    CssForecast,
    CssParams,
    OilRateCurvePoint,
    UncertaintyBand,
)
from app.simulator.reservoir import compute_vectorized_viscosity_cp


class CssTwinModel:
    """Surrogate CSS model calculating oil rate forecasts and uncertainty bands."""

    def __init__(self, n_monte_carlo: int = 100, seed: int = 42):
        self.n_monte_carlo = n_monte_carlo
        self.seed = seed

    def forecast(
        self,
        params: CssParams,
        current_res_temp_c: float | None = None,
        current_res_pressure_bar: float | None = None,
        drawdown_factor: float = 1.0,
    ) -> tuple[CssForecast, list[str]]:
        """
        Computes forward CSS production curve and economic metrics.
        Returns (CssForecast, warnings).
        """
        warnings = []
        steam_vol = params.steam_volume_tonnes
        inj_p = params.inj_pressure
        soak_d = params.soak_days
        wc_cut = params.production_cutoff_water_cut

        # Constraint clamping and safety warnings
        max_inj_p = FIELD_ASSUMPTIONS.css.inj_pressure_max_bar
        if inj_p > max_inj_p:
            warnings.append(
                f"Injection pressure {inj_p} bar exceeds safety cap {max_inj_p} bar; clamped to avoid formation fracture."
            )
            inj_p = max_inj_p

        if steam_vol < 300.0:
            warnings.append(
                f"Low steam volume ({steam_vol} t) provides insufficient thermal radius for heavy oil mobilization."
            )

        if soak_d > 14.0:
            warnings.append(
                f"Excessive soak time ({soak_d} days) causes significant conductive heat loss to overburden."
            )

        # Baseline reservoir parameters
        res_temp_base = current_res_temp_c or FIELD_ASSUMPTIONS.reservoir.initial_temperature_c

        # Thermal physics:
        # Steam saturation temp at injection pressure (approximate steam table)
        # Ts = 100 * (P / 1.01325)^0.25 in C
        t_steam_sat = min(260.0, 100.0 * (max(10.0, inj_p) / 1.01325) ** 0.22 + 50.0)

        # Heat delivered to formation (kJ)
        steam_vol * 1000.0 * FIELD_ASSUMPTIONS.css.steam_enthalpy_kj_kg

        # Thermal efficiency with diminishing returns:
        # As steam volume increases, heat losses outpace near-wellbore retention
        v_ref = 1500.0
        (steam_vol / (steam_vol + v_ref)) ** 0.50

        # Conductive soak loss penalty: optimal soak is 6-9 days
        soak_penalty = math.exp(-max(0.0, soak_d - 8.0) * 0.06) if soak_d > 8.0 else (0.8 + 0.025 * soak_d)

        # Peak heated zone temperature (C)
        delta_t_max = (t_steam_sat - res_temp_base) * (steam_vol / (steam_vol + 2200.0)) ** 0.45 * soak_penalty
        res_temp_base + delta_t_max

        # Monte Carlo vectorization across uncertain reservoir properties
        # Seeds local RNG for deterministic evaluation
        rng = np.random.RandomState(self.seed + int(steam_vol) % 1000)
        n_mc = self.n_monte_carlo

        # Uncertainty distributions:
        # Permeability factor, heat dissipation rate, and viscosity scale
        k_factor = rng.lognormal(mean=0.0, sigma=0.15, size=n_mc)
        tau_factor = rng.normal(loc=45.0, scale=6.0, size=n_mc)  # Thermal half-life in days
        tau_factor = np.clip(tau_factor, 25.0, 70.0)
        visc_perturb = rng.normal(loc=1.0, scale=0.08, size=n_mc)
        visc_perturb = np.clip(visc_perturb, 0.75, 1.35)

        # Time horizon: 90 days of production (sampled at daily steps)
        days = np.arange(1, 91)
        n_days = len(days)

        # Vectorized temperature decay: shape (n_mc, n_days)
        # T(t) = T_base + (T_peak - T_base) * exp(-ln(2) * t / tau)
        decay_constant = np.log(2.0) / tau_factor[:, np.newaxis]  # (n_mc, 1)
        temp_profiles = res_temp_base + delta_t_max * np.exp(-decay_constant * days[np.newaxis, :])  # (n_mc, n_days)

        # Vectorized viscosity profile: (n_mc, n_days)
        visc_profiles = compute_vectorized_viscosity_cp(temp_profiles) * visc_perturb[:, np.newaxis]

        # Oil rate calculation:
        # Composite radial inflow resistance: boundary resistance buffers infinite drop
        steam_factor = (steam_vol / (steam_vol + 1500.0)) ** 0.70
        composite_mobility = 1.0 / (visc_profiles / 8500.0 + 0.15)
        mobility_boost = np.power(composite_mobility, 0.40)

        # Water cut progression: rises over time
        wc_curve = np.clip(62.0 + 32.0 * (1.0 - np.exp(-days / 40.0)), 50.0, 96.0)  # (n_days,)
        oil_fraction = np.maximum(0.0, (wc_cut - wc_curve) / 100.0)  # Cutoff enforcement

        # Broad-cast oil rate: (n_mc, n_days)
        oil_rate_matrix = (
            14.5
            * steam_factor
            * k_factor[:, np.newaxis]
            * mobility_boost
            * drawdown_factor
            * oil_fraction[np.newaxis, :]
        )

        # Extract P10, P50, P90 at each day
        p10_curve = np.percentile(oil_rate_matrix, 10, axis=0)
        p50_curve = np.percentile(oil_rate_matrix, 50, axis=0)
        p90_curve = np.percentile(oil_rate_matrix, 90, axis=0)

        # Guarantee P10 <= P50 <= P90 strictly
        p10_curve = np.minimum(p10_curve, p50_curve)
        p90_curve = np.maximum(p90_curve, p50_curve)

        # Package daily curve
        oil_rate_curve = [
            OilRateCurvePoint(
                day=int(days[i]),
                p10=round(float(p10_curve[i]), 2),
                p50=round(float(p50_curve[i]), 2),
                p90=round(float(p90_curve[i]), 2),
            )
            for i in range(n_days)
        ]

        # Cumulative oil across the forecast window (bbls)
        cum_oil_p10 = float(np.sum(p10_curve))
        cum_oil_p50 = float(np.sum(p50_curve))
        cum_oil_p90 = float(np.sum(p90_curve))

        # Steam-Oil Ratio (SOR):
        # Steam in m3 (steam_vol tonnes ≈ m3 cold water equivalent) / oil in m3 (bbl / 6.2898)
        oil_m3_p50 = max(1.0, cum_oil_p50 / FIELD_ASSUMPTIONS.economics.bbl_per_m3)
        sor_p50 = steam_vol / oil_m3_p50

        # Economics
        steam_cost = steam_vol * FIELD_ASSUMPTIONS.economics.steam_cost_per_tonne_usd
        electricity_cost = n_days * 24.0 * 16.0 * FIELD_ASSUMPTIONS.economics.electricity_cost_per_kwh_usd
        total_energy_cost = steam_cost + electricity_cost

        forecast_result = CssForecast(
            params=params,
            oil_rate_curve=oil_rate_curve,
            cum_oil=round(cum_oil_p50, 1),
            sor=round(float(sor_p50), 2),
            energy_cost=round(float(total_energy_cost), 2),
            band=UncertaintyBand(
                p10=round(cum_oil_p10, 1),
                p50=round(cum_oil_p50, 1),
                p90=round(cum_oil_p90, 1),
            ),
        )

        return forecast_result, warnings
