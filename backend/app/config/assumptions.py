"""
OIL-TWIN AI - Engineering Assumptions, Limits, and Physical Properties
Baghewala Field, Rajasthan (Jodhpur Sandstone, 17-19 API Crude)

CRITICAL NOTE:
Every engineering constant, limit, and range in this file is commented:
# illustrative - replace with field data
"""
import hashlib
import json
from dataclasses import asdict, dataclass


@dataclass(frozen=True)
class ReservoirAssumptions:
    # illustrative - replace with field data: Jodhpur Sandstone Baghewala
    initial_temperature_c: float = 47.0        # illustrative - replace with field data (Range: 46 - 48 C)
    initial_pressure_bar: float = 38.0         # illustrative - replace with field data (Range: 35 - 45 bar, low depletion pressure)
    formation_depth_m: float = 1050.0          # illustrative - replace with field data
    net_pay_thickness_m: float = 18.0          # illustrative - replace with field data
    porosity: float = 0.24                     # illustrative - replace with field data (24% Jodhpur sandstone)
    permeability_md: float = 350.0             # illustrative - replace with field data
    rock_density_kg_m3: float = 2650.0         # illustrative - replace with field data
    rock_heat_capacity_kj_kg_c: float = 1.05   # illustrative - replace with field data
    overburden_thermal_diffusivity_m2_day: float = 0.08  # illustrative - replace with field data
    drainage_radius_m: float = 45.0            # illustrative - replace with field data


@dataclass(frozen=True)
class HeavyOilFluidAssumptions:
    # illustrative - replace with field data: 17-19 API Baghewala Crude
    api_gravity: float = 18.0                  # illustrative - replace with field data
    specific_gravity: float = 0.946            # illustrative - replace with field data (141.5 / (131.5 + API))
    oil_density_kg_m3: float = 946.0           # illustrative - replace with field data
    viscosity_ref_temp_c: float = 47.0         # illustrative - replace with field data
    viscosity_at_ref_temp_cp: float = 8500.0   # illustrative - replace with field data (8500 cP dead crude at 47 C)
    asphaltene_wt_pct: float = 14.5            # illustrative - replace with field data (High asphaltene precipitation risk)
    bubble_point_pressure_bar: float = 22.0    # illustrative - replace with field data
    solution_gor_sm3_m3: float = 8.0           # illustrative - replace with field data (Low dissolved gas)
    oil_heat_capacity_kj_kg_c: float = 2.10    # illustrative - replace with field data
    water_heat_capacity_kj_kg_c: float = 4.18  # illustrative - replace with field data
    water_density_kg_m3: float = 1000.0        # illustrative - replace with field data

    # Walther / Andrade viscosity model coefficients for Baghewala crude:
    # ln(viscosity_cp) = andrade_a + andrade_b / (T_C + 273.15)
    # Fitted to Baghewala PVT: ~8500 cP @ 47C, ~130 cP @ 120C, ~26 cP @ 180C, ~9 cP @ 250C
    andrade_a: float = -11.23                  # illustrative - replace with field data
    andrade_b: float = 6485.0                  # illustrative - replace with field data


@dataclass(frozen=True)
class CssCycleAssumptions:
    # illustrative - replace with field data: Cyclic Steam Stimulation operational envelope
    steam_volume_min_tonnes: float = 500.0     # illustrative - replace with field data
    steam_volume_max_tonnes: float = 3500.0    # illustrative - replace with field data
    steam_volume_default_tonnes: float = 1800.0 # illustrative - replace with field data

    inj_pressure_min_bar: float = 80.0         # illustrative - replace with field data
    inj_pressure_max_bar: float = 180.0        # illustrative - replace with field data (Safety cap below rock fracture P ~195 bar)
    inj_pressure_default_bar: float = 140.0    # illustrative - replace with field data

    steam_quality_wellhead: float = 0.80       # illustrative - replace with field data
    steam_enthalpy_kj_kg: float = 2780.0       # illustrative - replace with field data (at 140 bar, 80% quality)

    soak_days_min: float = 3.0                 # illustrative - replace with field data
    soak_days_max: float = 20.0                # illustrative - replace with field data
    soak_days_default: float = 8.0             # illustrative - replace with field data

    water_cut_cutoff_min_pct: float = 80.0     # illustrative - replace with field data
    water_cut_cutoff_max_pct: float = 96.0     # illustrative - replace with field data
    water_cut_cutoff_default_pct: float = 92.0 # illustrative - replace with field data

    injection_rate_tonnes_day: float = 140.0   # illustrative - replace with field data
    boberg_thermal_scavenge_half_life_days: float = 45.0 # illustrative - replace with field data


@dataclass(frozen=True)
class SrpMechanicsAssumptions:
    # illustrative - replace with field data: Sucker Rod Pumping system parameters
    stroke_length_min_m: float = 1.0           # illustrative - replace with field data
    stroke_length_max_m: float = 4.2           # illustrative - replace with field data
    stroke_length_default_m: float = 2.8       # illustrative - replace with field data

    spm_min: float = 1.5                       # illustrative - replace with field data
    spm_max: float = 12.0                      # illustrative - replace with field data
    spm_default: float = 4.5                   # illustrative - replace with field data

    vfd_hz_min: float = 15.0                   # illustrative - replace with field data
    vfd_hz_max: float = 65.0                   # illustrative - replace with field data
    vfd_hz_default: float = 45.0               # illustrative - replace with field data

    pump_depth_m: float = 980.0                # illustrative - replace with field data
    plunger_diameter_mm: float = 57.15         # illustrative - replace with field data (2.25 inch)
    rod_diameter_mm: float = 22.22             # illustrative - replace with field data (7/8 inch API Grade D)
    rod_elastic_modulus_gpa: float = 205.0     # illustrative - replace with field data (Steel)
    rod_density_kg_m3: float = 7850.0          # illustrative - replace with field data
    rod_tensile_strength_mpa: float = 800.0    # illustrative - replace with field data
    max_allowable_stress_pct: float = 80.0     # illustrative - replace with field data (Goodman safety threshold)

    min_pump_fillage_pct: float = 65.0         # illustrative - replace with field data (Threshold for fluid pound)
    rod_floating_viscosity_threshold_cp: float = 2500.0  # illustrative - replace with field data
    rod_floating_spm_factor: float = 450.0     # illustrative - replace with field data (Floating if mu * SPM > factor * 10)

    motor_nominal_kw: float = 30.0             # illustrative - replace with field data
    motor_nominal_efficiency: float = 0.88     # illustrative - replace with field data
    motor_nominal_voltage: float = 415.0       # illustrative - replace with field data
    power_factor: float = 0.85                 # illustrative - replace with field data


@dataclass(frozen=True)
class EconomicAssumptions:
    # illustrative - replace with field data: Economics for SOR & energy tradeoffs
    steam_cost_per_tonne_usd: float = 28.0     # illustrative - replace with field data (~INR 2350/t)
    electricity_cost_per_kwh_usd: float = 0.10 # illustrative - replace with field data (~INR 8.4/kWh)
    oil_price_per_bbl_usd: float = 70.0        # illustrative - replace with field data
    bbl_per_m3: float = 6.2898                 # constant unit conversion


@dataclass(frozen=True)
class FieldAssumptions:
    reservoir: ReservoirAssumptions = ReservoirAssumptions()
    fluid: HeavyOilFluidAssumptions = HeavyOilFluidAssumptions()
    css: CssCycleAssumptions = CssCycleAssumptions()
    srp: SrpMechanicsAssumptions = SrpMechanicsAssumptions()
    economics: EconomicAssumptions = EconomicAssumptions()

    def compute_hash(self) -> str:
        """Compute deterministic SHA-256 fingerprint of all engineering assumptions."""
        raw_dict = asdict(self)
        serialized = json.dumps(raw_dict, sort_keys=True, default=str)
        return hashlib.sha256(serialized.encode("utf-8")).hexdigest()[:16]


# Global singleton instance of assumptions
FIELD_ASSUMPTIONS = FieldAssumptions()
ASSUMPTIONS_HASH = FIELD_ASSUMPTIONS.compute_hash()
