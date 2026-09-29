"""
OIL-TWIN AI - Reservoir Physics Model (Baghewala Jodhpur Sandstone)
Implements:
1. Temperature-dependent viscosity (Walther / Andrade model for 17-19 API heavy crude)
2. Boberg-Lundberg thermal dissipation and reservoir temperature decline
3. Reservoir pressure dynamics and near-wellbore depletion
"""
import math

import numpy as np

from app.config.assumptions import FIELD_ASSUMPTIONS


def compute_oil_viscosity_cp(temp_c: float) -> float:
    """
    Compute heavy oil dynamic viscosity in cP using the Andrade equation:
    ln(viscosity) = a + b / (temp_c + 273.15)
    Calibrated for Baghewala heavy crude:
    - 47 C -> ~8500 cP
    - 120 C -> ~190 cP
    - 180 C -> ~22 cP
    - 240 C -> ~4 cP
    """
    temp_k = max(temp_c + 273.15, 273.15)
    a = FIELD_ASSUMPTIONS.fluid.andrade_a
    b = FIELD_ASSUMPTIONS.fluid.andrade_b
    ln_mu = a + (b / temp_k)
    # Clamp to physically realistic bounds for heavy oil (1.5 cP to 50,000 cP)
    viscosity = math.exp(max(math.log(1.5), min(math.log(50000.0), ln_mu)))
    return float(viscosity)


def compute_vectorized_viscosity_cp(temp_c_array: np.ndarray) -> np.ndarray:
    """Vectorized calculation of viscosity over temperature arrays."""
    temp_k = np.maximum(temp_c_array + 273.15, 273.15)
    a = FIELD_ASSUMPTIONS.fluid.andrade_a
    b = FIELD_ASSUMPTIONS.fluid.andrade_b
    ln_mu = a + (b / temp_k)
    return np.exp(np.clip(ln_mu, np.log(1.5), np.log(50000.0)))


def compute_reservoir_temperature_decay(
    day_in_cycle: float,
    peak_temp_c: float,
    soak_days: float,
    half_life_days: float = 45.0,
) -> float:
    """
    Boberg-Lundberg inspired thermal decay curve during production phase.
    Peak temperature is reached after steam soak. Overburden conduction drains heat over time.
    """
    base_temp = FIELD_ASSUMPTIONS.reservoir.initial_temperature_c
    if day_in_cycle <= soak_days:
        # During soak, near-wellbore heat equilibrates
        return float(peak_temp_c)

    prod_day = day_in_cycle - soak_days
    decay_rate = math.log(2.0) / max(half_life_days, 10.0)
    temp = base_temp + (peak_temp_c - base_temp) * math.exp(-decay_rate * prod_day)
    return float(max(base_temp, min(peak_temp_c, temp)))


def compute_reservoir_pressure(
    phase: str,
    day_in_cycle: float,
    inj_pressure_bar: float,
    soak_days: float,
    drawdown_factor: float = 0.05,
) -> float:
    """
    Compute average near-wellbore reservoir pressure (bar) across cycle phases.
    Low native pressure ~38 bar; elevates during steam injection, dissipates during soak and production.
    """
    native_p = FIELD_ASSUMPTIONS.reservoir.initial_pressure_bar
    if phase == "injection":
        # Pressurizes toward injection pressure minus hydrostatic head
        progress = min(1.0, day_in_cycle / 15.0)
        return float(native_p + (inj_pressure_bar * 0.7 - native_p) * progress)
    elif phase == "soak":
        # Pressure diffuses into the formation
        elevated_p = inj_pressure_bar * 0.7
        progress = min(1.0, day_in_cycle / max(soak_days, 1.0))
        return float(elevated_p - (elevated_p - native_p * 1.3) * progress)
    elif phase == "production":
        # Drawdown as pump extracts fluids
        prod_day = max(0.0, day_in_cycle - soak_days)
        drawdown = native_p * (1.0 - math.exp(-drawdown_factor * prod_day)) * 0.35
        return float(max(15.0, native_p - drawdown))
    else:  # idle
        return float(native_p)
