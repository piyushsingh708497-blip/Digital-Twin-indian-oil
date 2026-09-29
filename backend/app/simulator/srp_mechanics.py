"""
OIL-TWIN AI - SRP Rod Mechanics & Dynamometer Card Generator
Vectorized NumPy 1D wave dynamics modeling:
1. Surface and downhole load-displacement cards (100 points)
2. 6 diagnostic card classes: normal, rod_floating, fluid_pound, gas_interference, pump_unseating_risk, tagging
3. Peak and minimum rod loads, rod stress % of allowable, motor kW, and motor amps
4. Viscous drag and rod-floating threshold physics for Baghewala heavy crude
"""
import math

import numpy as np

from app.config.assumptions import FIELD_ASSUMPTIONS
from app.schemas.common import DynoDiagnosis
from app.schemas.dyno import DynoCard, DynoPoint


def evaluate_srp_condition(
    viscosity_cp: float,
    spm: float,
    stroke_length_m: float,
    pump_fillage_pct: float,
    fluid_level_m: float,
    gas_free_ratio: float = 0.05,
    tagging_flag: bool = False,
    unseating_flag: bool = False,
) -> tuple[DynoDiagnosis, float]:
    """
    Diagnoses the operational state based on physical fluid and mechanical thresholds:
    - High viscosity (>2500 cP) + high SPM (>4.5) -> rod_floating
    - Low fillage (<65%) -> fluid_pound
    - Gas presence -> gas_interference
    - Mechanical bottoming -> tagging
    - High load -> pump_unseating_risk
    - Otherwise -> normal
    """
    # 1. Rod floating check: heavy crude viscous drag counteracting rod gravity
    rod_floating_metric = (viscosity_cp / 1000.0) * (spm / 5.0)
    if rod_floating_metric > 3.2:
        confidence = min(0.98, 0.70 + (rod_floating_metric - 3.2) * 0.1)
        return "rod_floating", round(confidence, 2)

    # 2. Fluid pound check: insufficient pump fillage
    if pump_fillage_pct < FIELD_ASSUMPTIONS.srp.min_pump_fillage_pct:
        confidence = min(0.98, 0.75 + (65.0 - pump_fillage_pct) * 0.01)
        return "fluid_pound", round(confidence, 2)

    # 3. Gas interference check
    if gas_free_ratio > 0.15 and pump_fillage_pct < 80.0:
        return "gas_interference", 0.88

    # 4. Mechanical flags
    if tagging_flag:
        return "tagging", 0.94
    if unseating_flag:
        return "pump_unseating_risk", 0.91

    return "normal", 0.95


def compute_vectorized_dyno_card(
    diagnosis: DynoDiagnosis,
    stroke_length_m: float,
    spm: float,
    viscosity_cp: float,
    pump_fillage_pct: float,
    pump_depth_m: float = 980.0,
    n_points: int = 100,
    rng: np.random.RandomState = None,
) -> tuple[list[DynoPoint], list[DynoPoint], float, float]:
    """
    Generates vectorized surface and downhole dynamometer cards (position in meters, load in kN).
    Returns (surface_points, downhole_points, rod_load_max_kN, rod_load_min_kN).
    Vectorized implementation via NumPy array broadcasting.
    """
    if rng is None:
        rng = np.random.RandomState(42)

    # Time discretization across one complete stroke cycle
    theta = np.linspace(0, 2 * np.pi, n_points, endpoint=False)
    # Polished rod position: 0 at bottom dead center, stroke_length at top dead center
    surface_pos = (stroke_length_m / 2.0) * (1.0 - np.cos(theta))
    # Normalized stroke phase: 0 to 1 on upstroke, 1 to 0 on downstroke
    # Upstroke is theta from 0 to pi, downstroke is theta from pi to 2*pi
    is_upstroke = theta < np.pi

    # Base mechanical parameters
    plunger_d = FIELD_ASSUMPTIONS.srp.plunger_diameter_mm / 1000.0  # meters
    rod_d = FIELD_ASSUMPTIONS.srp.rod_diameter_mm / 1000.0
    a_plunger = np.pi * (plunger_d / 2.0) ** 2
    a_rod = np.pi * (rod_d / 2.0) ** 2
    rod_volume = a_rod * pump_depth_m
    rod_weight_air_n = rod_volume * FIELD_ASSUMPTIONS.srp.rod_density_kg_m3 * 9.81
    buoyancy_factor = 1.0 - (FIELD_ASSUMPTIONS.fluid.oil_density_kg_m3 / FIELD_ASSUMPTIONS.srp.rod_density_kg_m3)
    rod_weight_fluid_kn = (rod_weight_air_n * buoyancy_factor) / 1000.0  # kN (~30-38 kN)

    # Fluid column weight carried during upstroke (kN)
    fluid_column_h = pump_depth_m * 0.85
    fluid_weight_kn = (FIELD_ASSUMPTIONS.fluid.oil_density_kg_m3 * 9.81 * fluid_column_h * (a_plunger - a_rod)) / 1000.0  # kN (~18-28 kN)

    # Viscous drag force (kN)
    visc_factor = (viscosity_cp / 1000.0) * (spm / 5.0)
    drag_kn = float(min(18.0, 1.2 * visc_factor))

    # Downhole position: accounts for rod stretch and plunger overtravel
    stretch_m = (fluid_weight_kn * 1000.0 * pump_depth_m) / (FIELD_ASSUMPTIONS.srp.rod_elastic_modulus_gpa * 1e9 * a_rod)
    downhole_pos = np.clip(surface_pos * 0.95 + stretch_m * np.sin(theta), 0.0, stroke_length_m)

    # Construct Downhole Card (Pump Barrel Loads)
    fillage_fraction = pump_fillage_pct / 100.0

    # Smooth physical valve closure/opening transition across turnaround
    valve_transition = 0.5 * (1.0 + np.tanh(12.0 * np.sin(theta)))

    if diagnosis == "normal":
        downhole_load = fluid_weight_kn * valve_transition + 0.8 * np.sin(theta)

    elif diagnosis == "rod_floating":
        # Downhole load drops sharply; buoyant force + drag suspends plunger
        downhole_load = np.where(is_upstroke, fluid_weight_kn * 0.95, -drag_kn * 0.3)

    elif diagnosis == "fluid_pound":
        # Incomplete fillage: on downstroke, plunger falls through void, then impacts fluid at fillage point
        downstroke_fraction = (theta - np.pi) / np.pi  # 0 to 1
        pound_point = 1.0 - fillage_fraction
        downhole_load = np.where(is_upstroke, fluid_weight_kn * valve_transition, 0.0)
        # Severe fluid impact spike
        impact_mask = (~is_upstroke) & (downstroke_fraction > pound_point)
        downhole_load[impact_mask] += fluid_weight_kn * 0.75 * np.exp(-4.0 * (downstroke_fraction[impact_mask] - pound_point))

    elif diagnosis == "gas_interference":
        # Smooth gradual compression of trapped gas on downstroke
        downstroke_fraction = np.clip((theta - np.pi) / np.pi, 0.0, 1.0)
        gas_compression = fluid_weight_kn * np.exp(-3.5 * downstroke_fraction)
        downhole_load = np.where(is_upstroke, fluid_weight_kn * valve_transition, gas_compression)

    elif diagnosis == "pump_unseating_risk":
        # High friction or stuck plunger: upstroke load surges
        downhole_load = np.where(is_upstroke, fluid_weight_kn * 1.55 * valve_transition, 0.0)

    elif diagnosis == "tagging":
        # Plunger hits bottom seat at end of downstroke
        tag_mask = theta > (1.85 * np.pi)
        downhole_load = np.where(is_upstroke, fluid_weight_kn * valve_transition, 0.0)
        downhole_load[tag_mask] -= 12.0  # Sharp compressive shock

    # Construct Surface Card (Polished Rod Loads = Rod Weight + Downhole Load + Dynamic Harmonics + Drag)
    # Dynamic inertial and acceleration term (Mills / API RP 11L acceleration factor)
    omega = (2.0 * np.pi * spm) / 60.0
    accel_factor = (stroke_length_m * (omega ** 2)) / 9.81
    dynamic_boost_kn = rod_weight_fluid_kn * accel_factor * 0.85 * np.cos(theta)

    # Damped 1D wave harmonics (Gibbs solution surrogate)
    harmonic_kn = 2.5 * np.sin(2.0 * theta) + 1.2 * np.cos(3.0 * theta)

    # Viscous drag is proportional to rod velocity (vanishes smoothly at reversals)
    velocity_factor = np.sin(theta)
    applied_drag = drag_kn * velocity_factor

    if diagnosis == "rod_floating":
        # CRITICAL: Floating rods cannot follow the polished rod down!
        # Surface load collapses on downstroke (slack line), followed by catch-up shock!
        surface_load = np.where(
            is_upstroke,
            rod_weight_fluid_kn + fluid_weight_kn * valve_transition + applied_drag + dynamic_boost_kn + harmonic_kn,
            rod_weight_fluid_kn - drag_kn * 1.8 + dynamic_boost_kn * 0.5,
        )
        # Collapse load during mid-downstroke
        slack_mask = (theta > 1.2 * np.pi) & (theta < 1.7 * np.pi)
        surface_load[slack_mask] = np.clip(surface_load[slack_mask], 2.0, 8.0)  # Near-zero tension
        # Impact when rods hit polished rod carrier bar
        impact_mask = (theta >= 1.7 * np.pi) & (theta <= 1.95 * np.pi)
        surface_load[impact_mask] += 25.0 * np.sin((theta[impact_mask] - 1.7 * np.pi) * 10.0)

    elif diagnosis == "fluid_pound":
        surface_load = rod_weight_fluid_kn + downhole_load + applied_drag + dynamic_boost_kn + harmonic_kn
        downstroke_fraction = np.clip((theta - np.pi) / np.pi, 0.0, 1.0)
        pound_point = 1.0 - fillage_fraction
        shock_mask = (~is_upstroke) & (downstroke_fraction > pound_point)
        # High frequency ring-down vibrations on surface with sharp impact step
        surface_load[shock_mask] += 22.0 * np.sin(20.0 * (downstroke_fraction[shock_mask] - pound_point)) * np.exp(-3.0 * (downstroke_fraction[shock_mask] - pound_point))

    else:
        # Standard surface load
        surface_load = rod_weight_fluid_kn + downhole_load + applied_drag + dynamic_boost_kn + harmonic_kn

    # Sensor noise (deterministic via well RNG)
    sensor_noise_surface = rng.normal(0.0, 0.35, n_points)
    sensor_noise_downhole = rng.normal(0.0, 0.25, n_points)
    surface_load = np.maximum(2.0, surface_load + sensor_noise_surface)
    downhole_load = downhole_load + sensor_noise_downhole

    # Package as DynoPoint lists
    surface_points = [
        DynoPoint(position=round(float(surface_pos[i]), 3), load=round(float(surface_load[i]), 2))
        for i in range(n_points)
    ]
    downhole_points = [
        DynoPoint(position=round(float(downhole_pos[i]), 3), load=round(float(downhole_load[i]), 2))
        for i in range(n_points)
    ]

    rod_load_max_kn = float(np.max(surface_load))
    rod_load_min_kn = float(np.min(surface_load))

    return surface_points, downhole_points, rod_load_max_kn, rod_load_min_kn


def compute_srp_electromechanics(
    rod_load_max_kn: float,
    rod_load_min_kn: float,
    stroke_length_m: float,
    spm: float,
    vfd_hz: float,
    rod_d_mm: float = 22.22,
) -> tuple[float, float, float]:
    """
    Computes electrical and mechanical metrics:
    - kW: motor electric power demand
    - motor_amps: RMS phase current (A)
    - rod_stress_pct: stress as % of modified Goodman allowable
    """
    # 1. Hydraulic work per stroke (approximate load integral)
    delta_load_kn = max(5.0, rod_load_max_kn - rod_load_min_kn)
    work_per_stroke_kj = delta_load_kn * stroke_length_m * 0.72  # Parallelogram factor
    hydraulic_power_kw = (work_per_stroke_kj * spm) / 60.0

    # Motor losses & VFD efficiency
    efficiency = FIELD_ASSUMPTIONS.srp.motor_nominal_efficiency * (1.0 - 0.05 * abs(vfd_hz - 50.0) / 50.0)
    electric_power_kw = max(2.5, hydraulic_power_kw / max(0.5, efficiency) + 1.8)  # 1.8 kW tare friction

    # Motor current (415V 3-phase)
    voltage = FIELD_ASSUMPTIONS.srp.motor_nominal_voltage
    pf = FIELD_ASSUMPTIONS.srp.power_factor
    motor_amps = (electric_power_kw * 1000.0) / (math.sqrt(3.0) * voltage * pf)

    # 2. Modified Goodman rod stress %
    # Area of top rod
    rod_area_mm2 = math.pi * (rod_d_mm / 2.0) ** 2
    max_stress_mpa = (rod_load_max_kn * 1000.0) / rod_area_mm2
    min_stress_mpa = (rod_load_min_kn * 1000.0) / rod_area_mm2
    tensile_strength_mpa = FIELD_ASSUMPTIONS.srp.rod_tensile_strength_mpa
    allowable_stress_mpa = (tensile_strength_mpa / 4.0) + (0.5625 * min_stress_mpa)
    rod_stress_pct = min(120.0, (max_stress_mpa / max(50.0, allowable_stress_mpa)) * 100.0)

    return round(electric_power_kw, 2), round(motor_amps, 1), round(rod_stress_pct, 1)


def extract_dyno_features(card: DynoCard) -> dict[str, float]:
    """
    Extracts geometric, harmonic, and physical features STRICTLY from (x, load) points.
    Used by the ML classifier and diagnostic checks (no hidden simulator state used).
    """
    pos_s = np.array([p.position for p in card.surface])
    load_s = np.array([p.load for p in card.surface])
    pos_d = np.array([p.position for p in card.downhole])
    load_d = np.array([p.load for p in card.downhole])

    len(pos_s)
    stroke_length = float(np.max(pos_s) - np.min(pos_s))

    # Surface load extrema
    f_max = float(np.max(load_s))
    f_min = float(np.min(load_s))
    f_range = f_max - f_min
    f_mean = float(np.mean(load_s))

    # Polygon enclosed work area: shoelace formula
    work_area = 0.5 * abs(np.dot(pos_s, np.roll(load_s, 1)) - np.dot(load_s, np.roll(pos_s, 1)))

    # Separate upstroke and downstroke using position differences
    dx = np.diff(pos_s, append=pos_s[0])
    is_up = dx >= 0
    is_down = ~is_up

    up_load_mean = float(np.mean(load_s[is_up])) if np.any(is_up) else f_mean
    down_load_mean = float(np.mean(load_s[is_down])) if np.any(is_down) else f_mean
    down_load_min = float(np.min(load_s[is_down])) if np.any(is_down) else f_min

    # Downhole metrics
    dh_area = 0.5 * abs(np.dot(pos_d, np.roll(load_d, 1)) - np.dot(load_d, np.roll(pos_d, 1)))
    dh_max = float(np.max(load_d))
    dh_min = float(np.min(load_d))

    # Derivative metrics: shock/impact peaks (for fluid pound and tagging)
    d_load = np.diff(load_s)
    max_load_derivative = float(np.max(np.abs(d_load))) if len(d_load) > 0 else 0.0

    # Box fullness ratio
    box_area = max(0.1, f_range * stroke_length)
    fullness_ratio = float(work_area / box_area)

    return {
        "stroke_length": round(stroke_length, 3),
        "f_max": round(f_max, 2),
        "f_min": round(f_min, 2),
        "f_range": round(f_range, 2),
        "f_mean": round(f_mean, 2),
        "work_area": round(float(work_area), 2),
        "up_load_mean": round(up_load_mean, 2),
        "down_load_mean": round(down_load_mean, 2),
        "down_load_min": round(down_load_min, 2),
        "dh_area": round(float(dh_area), 2),
        "dh_max": round(dh_max, 2),
        "dh_min": round(dh_min, 2),
        "max_load_derivative": round(max_load_derivative, 2),
        "fullness_ratio": round(fullness_ratio, 3),
    }
