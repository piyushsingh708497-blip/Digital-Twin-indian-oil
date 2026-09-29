"""
OIL-TWIN AI - ML Models for Production and Temperature Prediction
IMPORTANT: Uses synthetic demonstration data. Not validated for Baghewala field.
Models are trained on synthetically generated data with physically sensible
relationships between CSS, SRP, reservoir and production parameters.
"""
import warnings

import numpy as np
import pandas as pd
from sklearn.ensemble import (
    GradientBoostingRegressor,
    RandomForestRegressor,
)
from sklearn.metrics import mean_squared_error
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

warnings.filterwarnings("ignore")

# ── Synthetic Dataset Generator ──────────────────────────────────────────────

def generate_synthetic_training_data(n_samples: int = 2000) -> pd.DataFrame:
    """
    Generate physically sensible synthetic training data for Baghewala-style heavy oil well.

    Physical relationships encoded:
    - Higher steam → higher reservoir temp
    - Higher temp → lower viscosity (Andrade equation approximation)
    - Lower viscosity → higher production
    - Extreme SPM → higher risk
    - Higher steam → higher energy consumption (and SOR if inefficient)
    """
    np.random.seed(42)
    rng = np.random.default_rng(42)

    # CSS parameters
    steam_volume = rng.uniform(200, 3000, n_samples)      # m³
    inj_pressure = rng.uniform(2000, 12000, n_samples)    # kPa
    soak_time = rng.uniform(2, 25, n_samples)             # days
    cycle_number = rng.integers(1, 15, n_samples)          # cycle #

    # Baseline reservoir conditions
    base_temp = rng.uniform(35, 70, n_samples)            # °C pre-steam
    base_pressure = rng.uniform(2000, 8000, n_samples)    # kPa

    # ── Temperature Response ──────────────────────────────────────────────────
    # Steam heats reservoir; more steam → more heating; higher pressure → deeper penetration
    temp_rise = (
        0.025 * steam_volume
        + 0.001 * inj_pressure
        - 2.0 * soak_time               # cooling during soak
        - 3.0 * (cycle_number - 1)      # diminishing heating per cycle
        + rng.normal(0, 5, n_samples)   # noise
    )
    temp_rise = np.clip(temp_rise, 0, 160)
    reservoir_temp = np.clip(base_temp + temp_rise, 35, 230)  # °C

    # ── Viscosity (Andrade approximation) ─────────────────────────────────────
    # ln(μ) ≈ A + B/T  →  μ decreases exponentially with temperature
    # For heavy oil: reference viscosity ~50000 cP at 30°C, ~200 cP at 150°C
    A_visc, B_visc = 2.5, 2800.0
    viscosity = np.exp(A_visc + B_visc / (reservoir_temp + 273.15))
    viscosity = np.clip(viscosity + rng.normal(0, 200, n_samples), 50, 60000)

    # ── SRP Parameters ────────────────────────────────────────────────────────
    stroke_length = rng.uniform(1.5, 5.5, n_samples)     # m
    spm = rng.uniform(2.0, 18.0, n_samples)              # strokes/min
    vfd_hz = rng.uniform(35.0, 60.0, n_samples)          # Hz

    # ── Pump Efficiency ───────────────────────────────────────────────────────
    # Higher viscosity → worse pump fill → lower efficiency
    # Extreme SPM → lower efficiency; moderate SPM optimal
    optimal_spm = 8.0
    spm_penalty = 0.5 * ((spm - optimal_spm) / optimal_spm) ** 2
    visc_penalty = 0.000008 * viscosity
    pump_eff = np.clip(
        85.0 - spm_penalty * 20 - visc_penalty + rng.normal(0, 3, n_samples),
        20.0, 95.0
    )

    # ── Production Rate ───────────────────────────────────────────────────────
    # Higher temp → lower viscosity → higher mobility → higher production
    mobility_factor = 1.0 / (1.0 + 0.0001 * viscosity)
    steam_factor = np.log1p(steam_volume) / np.log1p(3000)
    pressure_factor = base_pressure / 8000.0
    stroke_factor = stroke_length * spm / 60.0
    oil_rate = (
        2.0                          # base m³/day
        + 20.0 * mobility_factor
        + 8.0 * steam_factor
        + 5.0 * pressure_factor
        + 3.0 * stroke_factor
        + 0.05 * (pump_eff - 60)
        - 0.5 * (cycle_number - 1)   # decline per cycle
        + rng.normal(0, 1.5, n_samples)
    )
    oil_rate = np.clip(oil_rate, 0.5, 45.0)

    # ── Energy Consumption ────────────────────────────────────────────────────
    energy = (
        2.5 * steam_volume             # steam generation energy
        + 0.1 * inj_pressure
        + 150.0 * spm * stroke_length  # pump energy
        + rng.normal(0, 100, n_samples)
    )
    energy = np.clip(energy, 500, 80000)

    # Energy per barrel
    m3_to_bbl = 6.289
    energy_per_bbl = energy / np.maximum(oil_rate * m3_to_bbl, 0.1)
    energy_per_bbl = np.clip(energy_per_bbl, 1.0, 30.0)

    # ── Steam-Oil Ratio (SOR) ─────────────────────────────────────────────────
    # SOR = steam injected per cycle / total oil produced per cycle
    # Approximate cycle oil as rate × typical production days
    production_days = np.clip(60 - 3 * (cycle_number - 1), 15, 60)
    total_oil_cycle = oil_rate * production_days
    sor = steam_volume / np.maximum(total_oil_cycle, 1.0)
    sor = np.clip(sor + rng.normal(0, 0.2, n_samples), 0.5, 15.0)

    # ── Risk Indicators ───────────────────────────────────────────────────────
    # Rod floating: high fluid level, low pump fillage, low viscosity at pump
    rod_floating = np.clip(
        10
        + 0.001 * viscosity / (reservoir_temp + 1)
        - 0.5 * pump_eff
        + 2.0 * spm
        + rng.normal(0, 5, n_samples),
        0, 100
    )

    # Impact loading: high SPM, short stroke, high rod load
    impact_loading = np.clip(
        5 + 3.0 * spm - 5.0 * stroke_length + rng.normal(0, 5, n_samples),
        0, 100
    )

    # Pump unsetting: high viscosity, low temperature, high pressure differential
    pump_unsetting = np.clip(
        5 + 0.0005 * viscosity - 0.1 * reservoir_temp + rng.normal(0, 5, n_samples),
        0, 100
    )

    # Rod failure: high risk if extreme loads + poor efficiency
    rod_failure = np.clip(
        5 + 0.3 * impact_loading + 0.2 * pump_unsetting + rng.normal(0, 3, n_samples),
        0, 100
    )

    df = pd.DataFrame({
        "steam_volume_m3": steam_volume,
        "injection_pressure_kpa": inj_pressure,
        "soak_time_days": soak_time,
        "cycle_number": cycle_number,
        "base_reservoir_temp_c": base_temp,
        "reservoir_temp_c": reservoir_temp,
        "reservoir_pressure_kpa": base_pressure,
        "viscosity_cp": viscosity,
        "stroke_length_m": stroke_length,
        "spm": spm,
        "vfd_hz": vfd_hz,
        "pump_efficiency_pct": pump_eff,
        "oil_rate_m3d": oil_rate,
        "energy_kwh": energy,
        "energy_per_barrel_kwh": energy_per_bbl,
        "sor": sor,
        "rod_floating_risk": rod_floating,
        "impact_loading_risk": impact_loading,
        "pump_unsetting_risk": pump_unsetting,
        "rod_failure_risk": rod_failure,
    })
    return df


# ── Model Training ────────────────────────────────────────────────────────────

class OilTwinMLModels:
    """
    Container for all OIL-TWIN AI ML models.
    Trained on synthetic data — not scientifically validated for Baghewala field.
    """

    FEATURES_PRODUCTION = [
        "reservoir_temp_c", "reservoir_pressure_kpa", "viscosity_cp",
        "steam_volume_m3", "injection_pressure_kpa", "soak_time_days",
        "stroke_length_m", "spm", "vfd_hz", "cycle_number"
    ]

    FEATURES_TEMPERATURE = [
        "base_reservoir_temp_c", "steam_volume_m3", "injection_pressure_kpa",
        "soak_time_days", "cycle_number", "reservoir_pressure_kpa"
    ]

    FEATURES_RISK = [
        "viscosity_cp", "reservoir_temp_c", "reservoir_pressure_kpa",
        "spm", "stroke_length_m", "vfd_hz", "pump_efficiency_pct", "oil_rate_m3d"
    ]

    def __init__(self):
        self.production_model = GradientBoostingRegressor(
            n_estimators=150, max_depth=5, learning_rate=0.05, random_state=42
        )
        self.temperature_model = RandomForestRegressor(
            n_estimators=100, max_depth=8, random_state=42
        )
        self.pump_efficiency_model = GradientBoostingRegressor(
            n_estimators=100, max_depth=4, learning_rate=0.05, random_state=42
        )
        # Risk models (one per risk type)
        self.rod_floating_model = RandomForestRegressor(n_estimators=100, random_state=42)
        self.impact_loading_model = RandomForestRegressor(n_estimators=100, random_state=42)
        self.pump_unsetting_model = RandomForestRegressor(n_estimators=100, random_state=42)
        self.rod_failure_model = RandomForestRegressor(n_estimators=100, random_state=42)

        self.scaler = StandardScaler()
        self.trained = False
        self._train_all()

    def _train_all(self):
        print("[OIL-TWIN ML] Generating synthetic training dataset...")
        df = generate_synthetic_training_data(2000)

        # ── Production model ──────────────────────────────────────────────────
        X_prod = df[self.FEATURES_PRODUCTION]
        y_prod = df["oil_rate_m3d"]
        X_tr, X_te, y_tr, y_te = train_test_split(X_prod, y_prod, test_size=0.2, random_state=42)
        self.production_model.fit(X_tr, y_tr)
        rmse = np.sqrt(mean_squared_error(y_te, self.production_model.predict(X_te)))
        print(f"[OIL-TWIN ML] Production model RMSE: {rmse:.3f} m³/day (synthetic)")

        # ── Temperature model ─────────────────────────────────────────────────
        X_temp = df[self.FEATURES_TEMPERATURE]
        y_temp = df["reservoir_temp_c"]
        self.temperature_model.fit(X_temp, y_temp)

        # ── Pump efficiency model ─────────────────────────────────────────────
        X_pump = df[self.FEATURES_RISK]
        y_pump = df["pump_efficiency_pct"]
        self.pump_efficiency_model.fit(X_pump, y_pump)

        # ── Risk models ───────────────────────────────────────────────────────
        X_risk = df[self.FEATURES_RISK]
        self.rod_floating_model.fit(X_risk, df["rod_floating_risk"])
        self.impact_loading_model.fit(X_risk, df["impact_loading_risk"])
        self.pump_unsetting_model.fit(X_risk, df["pump_unsetting_risk"])
        self.rod_failure_model.fit(X_risk, df["rod_failure_risk"])

        self.trained = True
        print("[OIL-TWIN ML] All models trained successfully.")

    def predict_production(self, params: dict) -> dict:
        """Predict oil production rate (m³/day) with confidence interval."""
        X = pd.DataFrame([{f: params.get(f, 0) for f in self.FEATURES_PRODUCTION}])
        pred = float(np.clip(self.production_model.predict(X)[0], 0.1, 60.0))
        # Estimate uncertainty from individual tree predictions
        staged = list(self.production_model.staged_predict(X))
        uncertainty = float(np.std([s[0] for s in staged[-20:]])) if len(staged) >= 20 else 1.0
        confidence = float(np.clip(100 - uncertainty * 10, 50, 98))
        return {
            "predicted_value": pred,
            "confidence": confidence,
            "lower_bound": max(0, pred - 1.96 * uncertainty),
            "upper_bound": pred + 1.96 * uncertainty,
        }

    def predict_temperature(self, params: dict) -> dict:
        """Predict reservoir temperature (°C) after CSS."""
        X = pd.DataFrame([{f: params.get(f, 0) for f in self.FEATURES_TEMPERATURE}])
        pred = float(np.clip(self.temperature_model.predict(X)[0], 30, 230))
        # Forest std as uncertainty
        preds_trees = [t.predict(X)[0] for t in self.temperature_model.estimators_]
        std = float(np.std(preds_trees))
        confidence = float(np.clip(100 - std * 3, 55, 98))
        return {
            "predicted_value": pred,
            "confidence": confidence,
            "lower_bound": max(30, pred - 1.96 * std),
            "upper_bound": min(230, pred + 1.96 * std),
        }

    def predict_pump_efficiency(self, params: dict) -> float:
        """Predict pump efficiency (%)."""
        X = pd.DataFrame([{f: params.get(f, 50) for f in self.FEATURES_RISK}])
        return float(np.clip(self.pump_efficiency_model.predict(X)[0], 10, 98))

    def predict_risk(self, params: dict) -> dict:
        """Predict all equipment risk scores (0–100)."""
        X = pd.DataFrame([{f: params.get(f, 0) for f in self.FEATURES_RISK}])
        rod_float = float(np.clip(self.rod_floating_model.predict(X)[0], 0, 100))
        impact = float(np.clip(self.impact_loading_model.predict(X)[0], 0, 100))
        pump_uns = float(np.clip(self.pump_unsetting_model.predict(X)[0], 0, 100))
        rod_fail = float(np.clip(self.rod_failure_model.predict(X)[0], 0, 100))
        overall = float(np.clip(
            0.35 * rod_float + 0.25 * impact + 0.25 * pump_uns + 0.15 * rod_fail, 0, 100
        ))

        reasons = []
        if params.get("viscosity_cp", 0) > 5000:
            reasons.append("Elevated fluid viscosity increases pump loading")
        if params.get("spm", 0) > 12:
            reasons.append("High SPM outside preferred operating range increases rod stress")
        if params.get("reservoir_temp_c", 100) < 60:
            reasons.append("Low reservoir temperature indicates insufficient heating")
        if params.get("pump_efficiency_pct", 80) < 50:
            reasons.append("Low pump efficiency suggests incomplete fluid fillage")
        if rod_float > 60:
            reasons.append("Significant rod-floating risk detected — check pump submergence")
        if impact > 60:
            reasons.append("High impact loading may cause rod fatigue")
        if not reasons:
            reasons.append("Operating parameters within acceptable envelope")

        severity = "Low"
        if overall > 80:
            severity = "Critical"
        elif overall > 60:
            severity = "High"
        elif overall > 30:
            severity = "Medium"

        return {
            "rod_floating_risk": round(rod_float, 1),
            "impact_loading_risk": round(impact, 1),
            "pump_unsetting_risk": round(pump_uns, 1),
            "rod_failure_risk": round(rod_fail, 1),
            "overall_risk": round(overall, 1),
            "severity": severity,
            "reasons": reasons,
        }


# Singleton instance (loaded once at startup)
_ml_models: OilTwinMLModels | None = None


def get_ml_models() -> OilTwinMLModels:
    global _ml_models
    if _ml_models is None:
        _ml_models = OilTwinMLModels()
    return _ml_models
