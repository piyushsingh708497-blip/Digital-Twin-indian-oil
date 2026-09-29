"""
OIL-TWIN AI - Surface Facilities & Production Model
Calculates:
1. Wellhead pressure and temperature
2. Total liquid rate, dynamic water cut %, and oil rate
3. Derived Steam-Oil Ratio (SOR = steam injected / oil produced)
4. Derived energy efficiency (kWh/bbl)
"""
import math

from app.config.assumptions import FIELD_ASSUMPTIONS


def compute_surface_metrics(
    phase: str,
    stroke_length_m: float,
    spm: float,
    pump_fillage_pct: float,
    res_temp_c: float,
    res_pressure_bar: float,
    cum_steam_tonnes: float,
    cum_oil_m3: float,
    electric_power_kw: float,
    day_in_cycle: float,
    soak_days: float,
) -> dict:
    """
    Computes surface stream conditions and derived KPIs:
    - wellhead_pressure (bar)
    - wellhead_temp (C)
    - flow_rate (bbl/day)
    - water_cut_pct (0 - 100%)
    - oil_rate (bbl/day)
    - sor (tonnes steam / m3 oil or m3 steam eq / m3 oil)
    - kWhPerBbl (electric kWh / bbl oil produced)
    """
    bbl_per_m3 = FIELD_ASSUMPTIONS.economics.bbl_per_m3
    plunger_d_m = FIELD_ASSUMPTIONS.srp.plunger_diameter_mm / 1000.0
    plunger_area_m2 = math.pi * (plunger_d_m / 2.0) ** 2

    if phase == "production":
        # Theoretical pump displacement (m3/day)
        # Displacement = Area * Stroke * SPM * 1440 min/day
        displacement_m3_day = plunger_area_m2 * stroke_length_m * spm * 1440.0
        actual_liquid_m3_day = displacement_m3_day * (pump_fillage_pct / 100.0)

        # Water cut progression during CSS cycle:
        # Initial flow includes condensed steam water cut (~60-70%),
        # then plateaus during peak oil, then gradually rises as thermal bank cools
        prod_day = max(0.0, day_in_cycle - soak_days)
        base_wc = 65.0
        wc_rise = 30.0 * (1.0 - math.exp(-prod_day / 50.0))
        water_cut_pct = min(96.0, max(50.0, base_wc + wc_rise))

        # Net oil rate
        oil_fraction = max(0.02, (100.0 - water_cut_pct) / 100.0)
        oil_m3_day = actual_liquid_m3_day * oil_fraction
        oil_bbl_day = oil_m3_day * bbl_per_m3
        liquid_bbl_day = actual_liquid_m3_day * bbl_per_m3

        # Wellhead thermodynamics
        wellhead_temp = max(35.0, min(85.0, res_temp_c * 0.55 + 12.0))
        wellhead_pressure = max(1.5, min(15.0, res_pressure_bar * 0.12 + 1.8))

        # Derived Steam-Oil Ratio (SOR):
        # Direct physical derivation: cumulative steam injected / cumulative oil produced
        # If oil is zero/negligible: sor = None
        total_oil_prod_m3 = cum_oil_m3 + oil_m3_day * 0.5
        if total_oil_prod_m3 > 0.1 and cum_steam_tonnes > 0:
            derived_sor = round(float(cum_steam_tonnes / total_oil_prod_m3), 2)
        else:
            derived_sor = None

        # Derived kWh / bbl:
        # (Electric kW * 24 hrs) / oil_rate (bbl/day)
        # If oil is zero: kWhPerBbl = None
        if oil_bbl_day > 0.1:
            kwh_per_bbl = round(float((electric_power_kw * 24.0) / oil_bbl_day), 2)
        else:
            kwh_per_bbl = None

    elif phase == "injection":
        wellhead_temp = 180.0
        wellhead_pressure = 135.0
        liquid_bbl_day = 0.0
        water_cut_pct = 100.0
        oil_bbl_day = 0.0
        derived_sor = None
        kwh_per_bbl = None

    elif phase == "soak":
        wellhead_temp = 85.0
        wellhead_pressure = 45.0
        liquid_bbl_day = 0.0
        water_cut_pct = 95.0
        oil_bbl_day = 0.0
        derived_sor = None
        kwh_per_bbl = None

    else:  # idle
        wellhead_temp = 32.0
        wellhead_pressure = 1.0
        liquid_bbl_day = 0.0
        water_cut_pct = 0.0
        oil_bbl_day = 0.0
        derived_sor = None
        kwh_per_bbl = None

    return {
        "wellhead_pressure": round(float(wellhead_pressure), 2),
        "wellhead_temp": round(float(wellhead_temp), 1),
        "flow_rate": round(float(liquid_bbl_day), 2),
        "water_cut_pct": round(float(water_cut_pct), 1),
        "oil_rate": round(float(oil_bbl_day), 2),
        "sor": derived_sor,
        "kwh_per_bbl": kwh_per_bbl,
    }
