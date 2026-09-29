"""
OIL-TWIN AI - Wellbore Physics Model
Calculates:
1. Bottom-hole pressure (BHP) and temperature (BHT)
2. Dynamic working fluid level in the annulus
3. Steam quality along the tubing string during injection
"""
from app.config.assumptions import FIELD_ASSUMPTIONS


def compute_wellbore_state(
    phase: str,
    res_pressure_bar: float,
    res_temp_c: float,
    inj_pressure_bar: float,
    steam_rate_tonnes_day: float,
    pump_displacement_m3_day: float,
    inflow_m3_day: float,
    current_fluid_level_m: float,
) -> dict:
    """
    Computes wellbore operational conditions:
    - BHP (bar): reflects hydrostatic column + pump drawdown
    - BHT (C): wellbore bottom temperature
    - fluid_level (m): annulus distance from surface to liquid interface
    - steam_quality (fraction 0.0 - 1.0)
    """
    pump_depth = FIELD_ASSUMPTIONS.srp.pump_depth_m
    well_depth = FIELD_ASSUMPTIONS.reservoir.formation_depth_m

    if phase == "injection":
        # Steam flows down tubing
        bht = min(260.0, 180.0 + (inj_pressure_bar - 80.0) * 0.5)
        bhp = inj_pressure_bar * 0.92
        steam_quality = max(0.65, FIELD_ASSUMPTIONS.css.steam_quality_wellhead - 0.08)
        fluid_level = 0.0  # Well is packed with steam column
    elif phase == "soak":
        bht = max(res_temp_c, 160.0)
        bhp = res_pressure_bar * 1.1
        steam_quality = 0.0  # Condensing to hot water
        fluid_level = max(100.0, min(pump_depth * 0.3, current_fluid_level_m))
    elif phase == "production":
        bht = res_temp_c
        # Drawdown depends on pump withdrawal vs reservoir inflow
        net_withdrawal = pump_displacement_m3_day - inflow_m3_day
        # Annulus fluid level responds to net withdrawal
        delta_level = net_withdrawal * 1.2
        new_fluid_level = max(150.0, min(pump_depth - 20.0, current_fluid_level_m + delta_level))
        fluid_level = new_fluid_level
        # Hydrostatic column above perforations determines BHP
        column_height_m = max(0.0, well_depth - fluid_level)
        oil_rho = FIELD_ASSUMPTIONS.fluid.oil_density_kg_m3
        bhp = max(5.0, (oil_rho * 9.81 * column_height_m) / 1e5 + 2.0)
        steam_quality = 0.0
    else:  # idle
        bht = FIELD_ASSUMPTIONS.reservoir.initial_temperature_c
        bhp = res_pressure_bar
        fluid_level = 350.0
        steam_quality = 0.0

    return {
        "bhp": round(float(bhp), 2),
        "bht": round(float(bht), 2),
        "fluid_level": round(float(fluid_level), 1),
        "steam_quality": round(float(steam_quality), 3),
    }
