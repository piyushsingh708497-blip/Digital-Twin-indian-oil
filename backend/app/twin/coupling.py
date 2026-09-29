"""
OIL-TWIN AI - Well-to-Surface Coupled Twin Bridge
The central coupling module linking reservoir thermal stimulation (CSS) with surface lifting (SRP).

EXPLICIT COUPLING MECHANISMS:
1. [CSS -> SRP]: Steam volume and soak time dictate post-steam Bottom-Hole Temperature (BHT)
   and near-wellbore oil viscosity via the Walther/Andrade equation.
   Viscosity directly controls sucker rod downstroke drag force, rod tension ranges,
   and triggers rod floating when mu * SPM exceeds mechanical buoyant threshold.

2. [SRP -> CSS]: Sucker rod pump displacement and volumetric fillage dictate annular fluid level
   drawdown, which sets flowing bottom-hole pressure (P_wf).
   Effective drawdown (Delta P = P_res - P_wf) drives the Vogel/Darcy inflow performance
   relationship (IPR), scaling the forward CSS oil rate decline curve.
"""
from dataclasses import dataclass

from app.config.assumptions import FIELD_ASSUMPTIONS
from app.schemas.css import CssForecast, CssParams
from app.schemas.srp import SrpAnalysis, SrpSetpoints
from app.simulator.reservoir import compute_oil_viscosity_cp
from app.twin.css_model import CssTwinModel
from app.twin.srp_model import SrpTwinModel


@dataclass
class CoupledState:
    """Shared state variables exchanged between CSS reservoir and SRP wellbore models."""
    res_temp_c: float
    viscosity_cp: float
    fluid_level_m: float
    drawdown_factor: float
    pump_displacement_bbl_day: float


class CoupledTwin:
    """Coupled digital twin coordinating bidirectional interactions between CSS and SRP."""

    def __init__(self, css_twin: CssTwinModel, srp_twin: SrpTwinModel):
        self.css_twin = css_twin
        self.srp_twin = srp_twin

    def coupling_css_to_srp(
        self,
        steam_volume_tonnes: float,
        soak_days: float,
        base_temp_c: float = 47.0,
    ) -> tuple[float, float]:
        """
        Coupling Path 1: Steam stimulation heats reservoir -> lowers oil viscosity for SRP.
        Returns (post_steam_bht_c, post_steam_viscosity_cp).
        """
        # Peak thermal boost from steam
        t_sat = 215.0
        v_ref = 1500.0
        thermal_eff = (steam_volume_tonnes / (steam_volume_tonnes + v_ref)) ** 0.55
        soak_factor = 0.95 if (5.0 <= soak_days <= 10.0) else 0.80

        peak_bht = base_temp_c + (t_sat - base_temp_c) * thermal_eff * soak_factor
        viscosity = compute_oil_viscosity_cp(peak_bht)

        return round(peak_bht, 1), round(viscosity, 1)

    def coupling_srp_to_css(
        self,
        stroke_length_m: float,
        spm: float,
        reservoir_inflow_bbl_day: float = 120.0,
    ) -> tuple[float, float]:
        """
        Coupling Path 2: SRP pumping rate evacuates fluid -> lowers BHP -> enhances CSS drawdown.
        Returns (dynamic_fluid_level_m, css_drawdown_multiplier).
        """
        plunger_d_m = FIELD_ASSUMPTIONS.srp.plunger_diameter_mm / 1000.0
        # Theoretical displacement bbl/day
        area = 3.14159 * (plunger_d_m / 2.0) ** 2
        disp_m3 = area * stroke_length_m * spm * 1440.0
        disp_bbl = disp_m3 * FIELD_ASSUMPTIONS.economics.bbl_per_m3

        # Fluid drawdown equilibrium
        pump_depth = FIELD_ASSUMPTIONS.srp.pump_depth_m
        target_withdrawal = min(disp_bbl, reservoir_inflow_bbl_day * 1.5)
        drawdown_ratio = target_withdrawal / max(1.0, reservoir_inflow_bbl_day)

        # Deeper fluid level means lower hydrostatic backpressure on formation
        fluid_level = min(pump_depth - 30.0, 300.0 + drawdown_ratio * 350.0)

        # Drawdown multiplier on CSS production rate:
        # Standard optimum is around 1.0 to 1.35; excessive drawdown hits fluid pound
        drawdown_factor = min(1.4, max(0.6, 0.75 + 0.5 * min(1.2, drawdown_ratio)))

        return round(fluid_level, 1), round(drawdown_factor, 2)

    def evaluate_coupled_system(
        self,
        css_params: CssParams,
        srp_setpoints: SrpSetpoints,
        current_res_temp_c: float = 47.0,
        current_res_pressure_bar: float = 38.0,
    ) -> tuple[CssForecast, SrpAnalysis, list[str]]:
        """
        Executes coupled digital twin evaluation:
        1. CSS parameters generate thermal heating and reservoir viscosity
        2. SRP setpoints generate drawdown factor and fluid level
        3. Coupled outputs are passed to CSS and SRP models simultaneously
        """
        combined_warnings = []

        # 1. Forward Path 1: CSS -> SRP (Temperature & Viscosity)
        bht, visc = self.coupling_css_to_srp(
            steam_volume_tonnes=css_params.steam_volume_tonnes,
            soak_days=css_params.soak_days,
            base_temp_c=current_res_temp_c,
        )

        # 2. Forward Path 2: SRP -> CSS (Drawdown factor)
        fluid_lvl, drawdown_mult = self.coupling_srp_to_css(
            stroke_length_m=srp_setpoints.stroke_length,
            spm=srp_setpoints.spm,
        )

        # 3. Evaluate CSS Forecast with SRP-informed drawdown
        css_forecast, css_warn = self.css_twin.forecast(
            params=css_params,
            current_res_temp_c=bht,
            current_res_pressure_bar=current_res_pressure_bar,
            drawdown_factor=drawdown_mult,
        )
        combined_warnings.extend(css_warn)

        # 4. Evaluate SRP Analysis with CSS-informed viscosity and fluid level
        peak_daily_oil = css_forecast.oil_rate_curve[0].p50 if css_forecast.oil_rate_curve else 60.0
        inflow_estimate = peak_daily_oil / max(0.05, (100.0 - css_params.production_cutoff_water_cut) / 100.0)

        srp_analysis, srp_warn = self.srp_twin.analyze(
            setpoints=srp_setpoints,
            viscosity_cp=visc,
            fluid_level_m=fluid_lvl,
            inflow_liquid_bbl_day=inflow_estimate,
            water_cut_pct=72.0,
        )
        combined_warnings.extend(srp_warn)

        return css_forecast, srp_analysis, combined_warnings
