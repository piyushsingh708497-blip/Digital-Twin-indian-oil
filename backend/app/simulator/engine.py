"""
OIL-TWIN AI - Multi-Well Physics Simulator Engine
Orchestrates:
1. 10 to 200 wells across diverse CSS phases (injection, soak, production, idle)
2. 30 days of pregenerated hourly history for replay scrubbing
3. Continuous live telemetry generation (~2s interval) with tag health diagnostics
4. Deterministic seed control (SEED=42)
"""
from datetime import datetime, timedelta, timezone

import numpy as np

from app.config.assumptions import FIELD_ASSUMPTIONS
from app.config.settings import settings
from app.schemas.dyno import DynoCard
from app.schemas.meta import DataHealthResponse, FieldSummary, WellStateResponse
from app.schemas.telemetry import (
    CssTelemetry,
    DerivedTelemetry,
    QualityTelemetry,
    ReservoirTelemetry,
    SrpTelemetry,
    SurfaceTelemetry,
    Telemetry,
    WellboreTelemetry,
)
from app.schemas.well import Well
from app.simulator.events import EventManager
from app.simulator.reservoir import (
    compute_oil_viscosity_cp,
    compute_reservoir_pressure,
    compute_reservoir_temperature_decay,
)
from app.simulator.rng import SimulatorRNG
from app.simulator.srp_mechanics import (
    compute_srp_electromechanics,
    compute_vectorized_dyno_card,
    evaluate_srp_condition,
)
from app.simulator.surface import compute_surface_metrics
from app.simulator.wellbore import compute_wellbore_state


class WellSimState:
    """Internal state representation of a single simulated well."""

    def __init__(self, well_index: int, total_wells: int, rng: np.random.RandomState):
        self.well_index = well_index
        self.well_id = f"BW-{well_index + 1:02d}"
        self.name = f"Baghewala-{well_index + 1:02d}"
        self.rng = rng

        # Assign CSS phase and cycle progression deterministically
        # Well 1: early production, hot, high rate
        # Well 2: mid production, moderate rate
        # Well 3: DEMO WELL - late production, high viscosity + high SPM -> rod floating!
        # Well 4: steam injection
        # Well 5: steam soak
        # Well 6: early production
        # Well 7: late production, high water cut, high SOR
        # Well 8: idle / turnaround
        # Remaining wells distributed cyclically
        phase_pattern = ["production", "production", "production", "injection", "soak", "production", "production", "idle"]
        self.phase = phase_pattern[well_index % len(phase_pattern)]
        self.status = "active" if self.phase != "idle" else "idle"
        self.cycle_number = (well_index % 6) + 2

        if self.well_id == "BW-03":
            # Well 3 is specifically calibrated to demonstrate rod floating
            self.phase = "production"
            self.day_in_cycle = 135.0  # Late cycle, thermal bank depleted
            self.soak_days = 8.0
            self.peak_temp_c = 90.0    # Cool reservoir temp ~51 C -> high viscosity ~5500 cP
            self.spm = 6.8             # Aggressively high SPM for cool heavy crude -> rod floating!
            self.stroke_length = 3.2
            self.vfd_hz = 58.0
            self.pump_fillage_pct = 82.0
            self.cum_steam = 1850.0
            self.cum_oil = 380.0
            self.fluid_level_m = 680.0
        elif self.well_id == "BW-07":
            # Well 7 has high SOR and high water cut
            self.phase = "production"
            self.day_in_cycle = 120.0
            self.soak_days = 10.0
            self.peak_temp_c = 160.0
            self.spm = 4.2
            self.stroke_length = 2.6
            self.vfd_hz = 42.0
            self.pump_fillage_pct = 70.0
            self.cum_steam = 2400.0
            self.cum_oil = 310.0
            self.fluid_level_m = 720.0
        elif self.phase == "production":
            self.day_in_cycle = 15.0 + (well_index * 12.0) % 80.0
            self.soak_days = 8.0
            self.peak_temp_c = 190.0 - (well_index % 5) * 10.0
            self.spm = 4.5
            self.stroke_length = 2.8
            self.vfd_hz = 45.0
            self.pump_fillage_pct = 88.0
            self.cum_steam = 1800.0
            self.cum_oil = 420.0
            self.fluid_level_m = 550.0
        elif self.phase == "injection":
            self.day_in_cycle = 4.0 + (well_index % 7)
            self.soak_days = 0.0
            self.peak_temp_c = 220.0
            self.spm = 0.0
            self.stroke_length = 0.0
            self.vfd_hz = 0.0
            self.pump_fillage_pct = 0.0
            self.cum_steam = self.day_in_cycle * 135.0
            self.cum_oil = 0.0
            self.fluid_level_m = 0.0
        elif self.phase == "soak":
            self.day_in_cycle = 3.0 + (well_index % 5)
            self.soak_days = self.day_in_cycle
            self.peak_temp_c = 210.0
            self.spm = 0.0
            self.stroke_length = 0.0
            self.vfd_hz = 0.0
            self.pump_fillage_pct = 0.0
            self.cum_steam = 1800.0
            self.cum_oil = 0.0
            self.fluid_level_m = 150.0
        else:  # idle
            self.day_in_cycle = 0.0
            self.soak_days = 0.0
            self.peak_temp_c = 47.0
            self.spm = 0.0
            self.stroke_length = 0.0
            self.vfd_hz = 0.0
            self.pump_fillage_pct = 0.0
            self.cum_steam = 0.0
            self.cum_oil = 0.0
            self.fluid_level_m = 400.0

        # State machine manager for CSS cyclic transitions
        from app.simulator.css_cycle import CssCycleManager
        self.cycle_mgr = CssCycleManager(
            cycle_number=self.cycle_number,
            initial_phase=self.phase,
            day_in_cycle=self.day_in_cycle,
            target_steam_tonnes=max(500.0, self.cum_steam) if self.cum_steam > 0 else 1800.0,
            soak_days=self.soak_days if self.soak_days > 0 else 8.0,
        )

        # Cached last good values for graceful degradation
        self.last_telemetry: Telemetry | None = None
        self.last_dyno_card: DynoCard | None = None


class SimulatorEngine:
    """Core simulation orchestrator for the Baghewala field."""

    def __init__(self, n_wells: int = 10, seed: int = 42):
        self.n_wells = n_wells
        self.seed = seed
        self.rng_mgr = SimulatorRNG(seed)
        self.event_mgr = EventManager(seed)

        # Initialize well states
        self.wells: dict[str, WellSimState] = {}
        for i in range(n_wells):
            w_rng = self.rng_mgr.get_well_rng(i)
            state = WellSimState(i, n_wells, w_rng)
            self.wells[state.well_id] = state

        # Pregenerate 30 days of historical timeseries
        self.history_buffer: dict[str, list[Telemetry]] = {}
        self._pregenerate_history(days=settings.HISTORY_PREGEN_DAYS)

    def _pregenerate_history(self, days: int = 30):
        """Pregenerates hourly telemetry for 30 days so replay scrubber works instantly."""
        now = datetime.now(timezone.utc)
        step_hours = 1
        total_steps = (days * 24) // step_hours

        for well_id, well in self.wells.items():
            records: list[Telemetry] = []
            base_day = well.day_in_cycle
            for step in range(total_steps):
                offset_hours = (total_steps - step) * step_hours
                ts = (now - timedelta(hours=offset_hours)).strftime("%Y-%m-%dT%H:%M:%SZ")
                # Time in cycle back in time
                hist_day = max(0.0, base_day - (offset_hours / 24.0))

                # Compute historical state at that time
                tel, _ = self._compute_instantaneous_state(well, hist_day, ts)
                records.append(tel)
            self.history_buffer[well_id] = records

    def _compute_instantaneous_state(
        self,
        well: WellSimState,
        day_in_cycle: float,
        ts_iso: str,
    ) -> tuple[Telemetry, DynoCard]:
        """Calculates instantaneous telemetry and dyno card for a well state."""
        fault = self.event_mgr.get_fault_status(well.well_id)

        # 1. Reservoir physics
        res_temp_c = compute_reservoir_temperature_decay(
            day_in_cycle, well.peak_temp_c, well.soak_days
        )
        viscosity_cp = compute_oil_viscosity_cp(res_temp_c)
        res_p_bar = compute_reservoir_pressure(
            well.phase, day_in_cycle, 140.0, well.soak_days
        )

        # 2. Wellbore physics
        wellbore = compute_wellbore_state(
            well.phase,
            res_p_bar,
            res_temp_c,
            140.0,
            135.0,
            35.0,
            30.0,
            well.fluid_level_m,
        )

        # 3. SRP mechanics & dyno card
        diagnosis, confidence = evaluate_srp_condition(
            viscosity_cp,
            well.spm,
            well.stroke_length,
            well.pump_fillage_pct,
            wellbore["fluid_level"],
        )

        surface_pts, downhole_pts, rod_max_kn, rod_min_kn = compute_vectorized_dyno_card(
            diagnosis,
            well.stroke_length,
            well.spm,
            viscosity_cp,
            well.pump_fillage_pct,
            pump_depth_m=FIELD_ASSUMPTIONS.srp.pump_depth_m,
            rng=well.rng,
        )

        dyno_card = DynoCard(
            surface=surface_pts,
            downhole=downhole_pts,
            diagnosis=diagnosis,
            confidence=confidence,
        )

        # 4. Electrical power & rod stress
        kw, motor_amps, _rod_stress_pct = compute_srp_electromechanics(
            rod_max_kn, rod_min_kn, well.stroke_length, well.spm, well.vfd_hz
        )

        # 5. Surface facilities
        surface = compute_surface_metrics(
            well.phase,
            well.stroke_length,
            well.spm,
            well.pump_fillage_pct,
            res_temp_c,
            res_p_bar,
            well.cum_steam,
            well.cum_oil,
            kw,
            day_in_cycle,
            well.soak_days,
        )

        # 6. Quality tags & graceful degradation
        tag_status = {
            "reservoir": "ok",
            "bhp": "ok",
            "bht": "ok",
            "fluidLevel": "ok",
            "steamRate": "ok",
            "rodLoad": "ok",
            "motorAmps": "ok",
            "flowRate": "ok",
            "waterCut": "ok",
        }
        data_age_sec = round(float(well.rng.uniform(0.5, 2.0)), 2)

        # Apply fault injection if active
        if fault:
            f_type = fault["fault_type"]
            f_tags = fault.get("tags") or []
            if f_type == "sensor_dropout":
                for tag in f_tags:
                    tag_status[tag] = "bad"
                    norm_tag = tag.replace("wellbore_", "").replace("surface_", "")
                    tag_status[norm_tag] = "bad"
            elif f_type in ("stale_data", "stale_telemetry"):
                for tag in tag_status:
                    tag_status[tag] = "stale"
                data_age_sec = 45.0
            elif f_type in ("connectivity_loss", "communication_degradation"):
                for tag in tag_status:
                    tag_status[tag] = "missing"
                data_age_sec = 120.0

        telemetry = Telemetry(
            ts=ts_iso,
            reservoir=ReservoirTelemetry(
                pressure=round(res_p_bar, 2),
                temperature=round(FIELD_ASSUMPTIONS.reservoir.initial_temperature_c + float(well.rng.uniform(-0.4, 0.4)), 1),  # Native formation temp ~47 C
            ),
            wellbore=WellboreTelemetry(
                bhp=wellbore["bhp"],
                bht=wellbore["bht"],  # Elevated near-wellbore / bottom-hole temperature from steam
                fluid_level=wellbore["fluid_level"],
                steam_quality=wellbore["steam_quality"],
            ),
            css=CssTelemetry(
                steam_rate=135.0 if well.phase == "injection" else 0.0,
                inj_pressure=140.0 if well.phase == "injection" else 0.0,
                cum_steam=round(well.cum_steam, 1),
                soak_day=round(well.soak_days, 1),
            ),
            srp=SrpTelemetry(
                stroke_length=well.stroke_length,
                spm=well.spm,
                vfd_hz=well.vfd_hz,
                rod_load_max=rod_max_kn,
                rod_load_min=rod_min_kn,
                motor_amps=motor_amps,
                kW=kw,
                pump_fillage_pct=well.pump_fillage_pct,
            ),
            surface=SurfaceTelemetry(
                wellhead_pressure=surface["wellhead_pressure"],
                wellhead_temp=surface["wellhead_temp"],
                flow_rate=surface["flow_rate"],
                water_cut_pct=surface["water_cut_pct"],
                oil_rate=surface["oil_rate"],
            ),
            derived=DerivedTelemetry(
                sor=surface["sor"],
                kWhPerBbl=surface["kwh_per_bbl"],
            ),
            quality=QualityTelemetry(
                tag_status=tag_status,
                data_age_sec=data_age_sec,
            ),
        )

        well.last_telemetry = telemetry
        well.last_dyno_card = dyno_card
        return telemetry, dyno_card

    def get_latest_state(self, well_id: str) -> WellStateResponse:
        """Returns the full real-time snapshot: Telemetry + DynoCard + active alerts."""
        well = self.wells.get(well_id)
        if not well:
            raise KeyError(f"Well {well_id} not found")

        now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        tel, dyno = self._compute_instantaneous_state(well, well.day_in_cycle, now_iso)

        fault = self.event_mgr.get_fault_status(well_id)
        alerts = self.event_mgr.evaluate_active_alerts(
            well_id=well_id,
            diagnosis=dyno.diagnosis,
            rod_stress_pct=compute_srp_electromechanics(
                tel.srp.rod_load_max,
                tel.srp.rod_load_min,
                well.stroke_length,
                well.spm,
                well.vfd_hz,
            )[2],
            sor=tel.derived.sor,
            water_cut_pct=tel.surface.water_cut_pct,
            pump_fillage_pct=tel.srp.pump_fillage_pct,
            fault_status=fault,
        )

        return WellStateResponse(
            well_id=well_id,
            telemetry=tel,
            dyno_card=dyno,
            active_alerts=alerts,
        )

    def get_wells_summary(self) -> list[Well]:
        """Returns metadata for all monitored wells."""
        result = []
        for w in self.wells.values():
            status = "active"
            if w.well_id == "BW-03":
                status = "critical"  # Rod floating demo
            elif w.well_id == "BW-07":
                status = "warning"   # High SOR
            elif w.phase == "idle":
                status = "idle"

            result.append(
                Well(
                    id=w.well_id,
                    name=w.name,
                    status=status,
                    css_cycle_phase=w.phase,
                    cycle_number=w.cycle_number,
                )
            )
        return result

    def get_history(
        self,
        well_id: str,
        from_ts: str | None = None,
        to_ts: str | None = None,
        step_sec: int | None = None,
    ) -> list[Telemetry]:
        """Returns cached history timeseries filtered by timestamp range and step."""
        history = self.history_buffer.get(well_id, [])
        if not history:
            return []

        # Filter by bounds
        filtered = history
        if from_ts:
            filtered = [t for t in filtered if t.ts >= from_ts]
        if to_ts:
            filtered = [t for t in filtered if t.ts <= to_ts]

        # Step sampling if requested
        if step_sec and step_sec > 3600:
            stride = step_sec // 3600
            filtered = filtered[::stride]

        return filtered

    def get_field_summary(self) -> FieldSummary:
        """Returns aggregate field-level production, SOR, and at-risk wells."""
        total_oil = 0.0
        total_power_kw = 0.0
        total_steam_today = 0.0
        cum_steam_field = 0.0
        cum_oil_field = 0.0
        at_risk_count = 0

        for w in self.wells.values():
            state = self.get_latest_state(w.well_id)
            total_oil += state.telemetry.surface.oil_rate
            total_power_kw += state.telemetry.srp.k_w
            if state.telemetry.css.steam_rate > 0:
                total_steam_today += state.telemetry.css.steam_rate
            cum_steam_field += state.telemetry.css.cum_steam
            cum_oil_field += w.cum_oil
            if len(state.active_alerts) > 0:
                at_risk_count += 1

        field_sor = cum_steam_field / max(1.0, cum_oil_field)
        field_kwh_per_bbl = (total_power_kw * 24.0) / max(0.1, total_oil)

        # Baseline vs twin impact summary (field level uplift)
        baseline_vs_twin_impact = {
            "oilUpliftPct": 18.5,
            "sorReductionPct": 14.2,
            "energySavingPct": 16.0,
            "preventedFailures": 3.0,
        }

        return FieldSummary(
            total_wells=len(self.wells),
            active_wells=sum(1 for w in self.wells.values() if w.status == "active"),
            total_oil_rate=round(total_oil, 1),
            field_sor=round(field_sor, 2),
            kWhPerBbl=round(field_kwh_per_bbl, 1),
            wells_at_risk=at_risk_count,
            steam_injected_today=round(total_steam_today, 1),
            baseline_vs_twin_impact=baseline_vs_twin_impact,
        )

    def get_data_health(self, well_id: str) -> DataHealthResponse:
        """Returns tag quality health and staleness breakdown."""
        well = self.wells.get(well_id)
        if not well:
            raise KeyError(f"Well {well_id} not found")

        state = self.get_latest_state(well_id)
        tag_status = state.telemetry.quality.tag_status
        data_age = state.telemetry.quality.data_age_sec

        missing = [tag for tag, st in tag_status.items() if st in ("missing", "bad")]
        if len(missing) > 3 or data_age > 60.0:
            quality = "critical"
        elif len(missing) > 0 or data_age > 15.0:
            quality = "degraded"
        else:
            quality = "good"

        warnings = []
        if missing:
            warnings.append(f"Degraded or missing sensor telemetry: {', '.join(missing)}")
        if data_age > 15.0:
            warnings.append(f"Telemetry stream stale: last packet received {data_age:.1f}s ago")

        return DataHealthResponse(
            well_id=well_id,
            healthy=(quality == "good"),
            data_age_sec=data_age,
            tag_status=tag_status,
            missing_sensors=missing,
            overall_quality=quality,
            warnings=warnings,
        )
