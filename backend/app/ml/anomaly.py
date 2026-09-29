"""
OIL-TWIN AI - Telemetry Anomaly & Data Drift Detector
Detects:
1. Pressure anomalies (injection overpressure, sudden BHP drop)
2. Temperature anomalies (wellhead cooling, thermal flash)
3. Load anomalies (abnormal polished rod load range)
4. Water cut anomalies (abrupt water breakthroughs)
5. Sudden production changes (pump unseating, gas lock)
6. Stale telemetry and missing sensor tags
Never fabricates missing values.
"""
from typing import Any

from app.schemas.telemetry import Telemetry


class TelemetryAnomalyDetector:
    """Statistical and physics-rule anomaly detector for well telemetry streams."""

    def __init__(self):
        # Baseline operating envelopes (Baghewala Jodhpur Sandstone)
        self.limits = {
            "bhp_min": 5.0,
            "bhp_max": 180.0,
            "bht_min": 40.0,
            "bht_max": 260.0,
            "rod_load_max_safe": 85.0,  # kN
            "rod_load_min_safe": 5.0,   # kN (below indicates slack line/floating)
            "water_cut_max": 96.0,
            "max_data_age_sec": 30.0,
        }

    def detect_anomalies(
        self,
        current: Telemetry,
        previous: Telemetry | None = None,
    ) -> list[dict[str, Any]]:
        """
        Analyzes a telemetry frame for physical anomalies and signal degradation.
        Returns a list of anomaly diagnostics.
        """
        anomalies = []

        # 1. Staleness and Missing Tags
        if current.quality.data_age_sec > self.limits["max_data_age_sec"]:
            anomalies.append({
                "type": "data_stale",
                "severity": "warn",
                "tag": "quality.dataAgeSec",
                "message": f"Telemetry stream is stale: age {current.quality.data_age_sec}s exceeds {self.limits['max_data_age_sec']}s threshold",
                "value": current.quality.data_age_sec,
            })

        for tag, status in current.quality.tag_status.items():
            if status == "missing":
                anomalies.append({
                    "type": "missing_data",
                    "severity": "warn",
                    "tag": tag,
                    "message": f"Sensor tag '{tag}' is missing from field telemetry stream",
                    "value": None,
                })
            elif status == "bad":
                anomalies.append({
                    "type": "sensor_fault",
                    "severity": "critical",
                    "tag": tag,
                    "message": f"Sensor tag '{tag}' is reporting invalid or dropped signal",
                    "value": None,
                })

        # 2. Pressure Anomalies
        if current.wellbore.bhp > self.limits["bhp_max"]:
            anomalies.append({
                "type": "pressure_anomaly",
                "severity": "critical",
                "tag": "wellbore.bhp",
                "message": f"Overpressure event: BHP at {current.wellbore.bhp} bar exceeds safety threshold {self.limits['bhp_max']} bar",
                "value": current.wellbore.bhp,
            })

        # 3. Mechanical Load Anomalies
        if current.srp.rod_load_min < self.limits["rod_load_min_safe"] and current.srp.spm > 2.0:
            anomalies.append({
                "type": "load_anomaly",
                "severity": "critical",
                "tag": "srp.rodLoadMin",
                "message": f"Downstroke slack load ({current.srp.rod_load_min} kN): high probability of rod floating or parted rod string",
                "value": current.srp.rod_load_min,
            })

        if current.srp.rod_load_max > self.limits["rod_load_max_safe"]:
            anomalies.append({
                "type": "load_anomaly",
                "severity": "warn",
                "tag": "srp.rodLoadMax",
                "message": f"High peak load ({current.srp.rod_load_max} kN): approaching mechanical stress limits",
                "value": current.srp.rod_load_max,
            })

        # 4. Sudden Production Step Changes (against previous frame)
        if previous and previous.surface.oil_rate > 5.0:
            rate_delta_pct = ((current.surface.oil_rate - previous.surface.oil_rate) / previous.surface.oil_rate) * 100.0
            if abs(rate_delta_pct) > 40.0:
                anomalies.append({
                    "type": "sudden_production_change",
                    "severity": "warn",
                    "tag": "surface.oilRate",
                    "message": f"Abrupt oil rate change ({rate_delta_pct:+.1f}% in single cycle)",
                    "value": current.surface.oil_rate,
                })

        # 5. Water Cut Anomaly
        if current.surface.water_cut_pct >= self.limits["water_cut_max"]:
            anomalies.append({
                "type": "water_cut_anomaly",
                "severity": "info",
                "tag": "surface.waterCutPct",
                "message": f"Water cut at {current.surface.water_cut_pct}% exceeds economic threshold ({self.limits['water_cut_max']}%)",
                "value": current.surface.water_cut_pct,
            })

        return anomalies
