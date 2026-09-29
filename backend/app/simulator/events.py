"""
OIL-TWIN AI - Scripted Timeline Events & Fault Injections
Deterministic, seed-driven events ensuring live demo paths:
1. Well BW-03 exhibits rod floating episode (high viscosity + high SPM)
2. Well BW-07 experiences high water cut / high SOR
3. Well BW-02 displays rising rod fatigue failure risk
4. Dynamically injected sensor dropout / stale data faults
"""
import time
from typing import Any

from app.schemas.alerts import Alert


class EventManager:
    """Manages scheduled demo timeline episodes and interactive fault injections."""

    def __init__(self, master_seed: int = 42):
        self.master_seed = master_seed
        # Injected faults: well_id -> dict of fault properties
        self.active_faults: dict[str, dict[str, Any]] = {}

    def inject_fault(
        self,
        well_id: str,
        fault_type: str,
        tags: list | None = None,
        duration_sec: int = 300,
    ) -> dict[str, Any]:
        """Inject a sensor fault, stale data, or connectivity drop."""
        if fault_type == "clear":
            self.active_faults.pop(well_id, None)
            return {"status": "cleared", "well_id": well_id}

        expires_at = time.time() + duration_sec
        self.active_faults[well_id] = {
            "fault_type": fault_type,
            "tags": set(tags) if tags else {"bhp", "bht", "rodLoadMax", "flowRate"},
            "expires_at": expires_at,
        }
        return {
            "status": "injected",
            "well_id": well_id,
            "fault_type": fault_type,
            "tags": list(self.active_faults[well_id]["tags"]),
            "duration_sec": duration_sec,
        }

    def get_fault_status(self, well_id: str) -> dict[str, Any] | None:
        """Return active fault status for a well, auto-expiring old faults."""
        fault = self.active_faults.get(well_id)
        if not fault:
            return None
        if time.time() > fault["expires_at"]:
            self.active_faults.pop(well_id, None)
            return None
        return fault

    def evaluate_active_alerts(
        self,
        well_id: str,
        diagnosis: str,
        rod_stress_pct: float,
        sor: float,
        water_cut_pct: float,
        pump_fillage_pct: float,
        fault_status: dict[str, Any] | None = None,
    ) -> list[Alert]:
        """
        Evaluates operational thresholds and produces active alerts:
        - rod_floating
        - rod_failure_risk
        - high_sor
        - impact_loading
        - pump_unsetting
        - sensor_fault / data_stale
        """
        alerts = []
        now_iso = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

        # 1. Fault-driven alerts
        if fault_status:
            f_type = fault_status["fault_type"]
            if f_type == "sensor_dropout":
                alerts.append(
                    Alert(
                        id=f"ALT-SENS-{well_id}",
                        well_id=well_id,
                        severity="warn",
                        kind="sensor_fault",
                        probability=0.99,
                        time_to_event_hrs=0.0,
                        message=f"Sensor dropout detected on telemetry tags: {list(fault_status['tags'])}",
                        acknowledged=False,
                        created_at=now_iso,
                    )
                )
            elif f_type in ("stale_data", "connectivity_loss"):
                alerts.append(
                    Alert(
                        id=f"ALT-STALE-{well_id}",
                        well_id=well_id,
                        severity="warn",
                        kind="data_stale",
                        probability=0.95,
                        time_to_event_hrs=0.0,
                        message="Telemetry stream stale: no tag refresh received for > 30 seconds",
                        acknowledged=False,
                        created_at=now_iso,
                    )
                )

        # 2. Physics-driven alerts
        if diagnosis == "rod_floating":
            alerts.append(
                Alert(
                    id=f"ALT-FLOAT-{well_id}",
                    well_id=well_id,
                    severity="critical",
                    kind="rod_floating",
                    probability=0.94,
                    time_to_event_hrs=1.5,
                    message="Rod floating detected: heavy crude viscous drag exceeds rod buoyant weight on downstroke",
                    acknowledged=False,
                    created_at=now_iso,
                )
            )

        if rod_stress_pct > 80.0:
            severity = "critical" if rod_stress_pct > 90.0 else "warn"
            alerts.append(
                Alert(
                    id=f"ALT-STRESS-{well_id}",
                    well_id=well_id,
                    severity=severity,
                    kind="rod_failure_risk",
                    probability=round(min(0.99, 0.4 + (rod_stress_pct - 80.0) * 0.03), 2),
                    time_to_event_hrs=round(max(4.0, 72.0 - (rod_stress_pct - 80.0) * 3.0), 1),
                    message=f"High cyclic rod stress ({rod_stress_pct}% of Goodman allowable limit)",
                    acknowledged=False,
                    created_at=now_iso,
                )
            )

        if diagnosis == "fluid_pound":
            alerts.append(
                Alert(
                    id=f"ALT-POUND-{well_id}",
                    well_id=well_id,
                    severity="warn",
                    kind="impact_loading",
                    probability=0.88,
                    time_to_event_hrs=12.0,
                    message=f"Fluid pound detected: pump fillage at {pump_fillage_pct}%, traveling valve shock loading",
                    acknowledged=False,
                    created_at=now_iso,
                )
            )

        if diagnosis == "pump_unseating_risk":
            alerts.append(
                Alert(
                    id=f"ALT-UNSEAT-{well_id}",
                    well_id=well_id,
                    severity="critical",
                    kind="pump_unsetting",
                    probability=0.85,
                    time_to_event_hrs=6.0,
                    message="Pump unseating risk: upstroke friction exceeds mechanical hold-down capacity",
                    acknowledged=False,
                    created_at=now_iso,
                )
            )

        if sor is not None and sor > 5.5:
            alerts.append(
                Alert(
                    id=f"ALT-SOR-{well_id}",
                    well_id=well_id,
                    severity="info" if sor < 7.0 else "warn",
                    kind="high_sor",
                    probability=0.82,
                    time_to_event_hrs=48.0,
                    message=f"Elevated Steam-Oil Ratio (SOR = {sor:.1f} m3/m3), exceeding economic threshold",
                    acknowledged=False,
                    created_at=now_iso,
                )
            )

        return alerts
