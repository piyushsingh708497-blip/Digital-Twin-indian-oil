"""
OIL-TWIN AI - Cyclic Steam Stimulation (CSS) Cycle State Machine
Models phase transitions, duration tracking, and cyclic thermal state:
1. Injection phase: high pressure steam delivery into formation
2. Soak phase: shut-in thermal equilibration and steam condensation
3. Production phase: sucker rod pumping, thermal scavenge decline, water cut rise
4. Idle phase: economic cutoff reached, turnaround before next cycle
"""
from dataclasses import dataclass

from app.schemas.common import CssCyclePhase


@dataclass
class CycleProgress:
    phase: CssCyclePhase
    cycle_number: int
    day_in_phase: float
    total_phase_days: float
    phase_completion_pct: float
    cum_steam_this_cycle: float
    cum_oil_this_cycle: float


class CssCycleManager:
    """Manages lifecycle progression and state machine transitions for CSS operations."""

    def __init__(
        self,
        cycle_number: int = 1,
        initial_phase: CssCyclePhase = "production",
        day_in_cycle: float = 15.0,
        target_steam_tonnes: float = 1800.0,
        soak_days: float = 8.0,
        steam_rate_tonnes_day: float = 135.0,
        production_cutoff_wc_pct: float = 92.0,
    ):
        self.cycle_number = cycle_number
        self.phase = initial_phase
        self.day_in_cycle = day_in_cycle
        self.target_steam_tonnes = target_steam_tonnes
        self.soak_days = soak_days
        self.steam_rate_tonnes_day = steam_rate_tonnes_day
        self.production_cutoff_wc_pct = production_cutoff_wc_pct

        # Calculated phase durations
        self.injection_duration_days = target_steam_tonnes / max(10.0, steam_rate_tonnes_day)
        self.soak_duration_days = soak_days
        self.typical_production_days = 90.0

    def get_progress(self, current_day: float, current_wc_pct: float) -> CycleProgress:
        """Determines active phase and completion percentage given simulation day."""
        t_inj = self.injection_duration_days
        t_soak = self.soak_duration_days

        if current_day < t_inj:
            phase: CssCyclePhase = "injection"
            day_in_phase = current_day
            total_phase_days = t_inj
            cum_steam = min(self.target_steam_tonnes, current_day * self.steam_rate_tonnes_day)
            cum_oil = 0.0
        elif current_day < (t_inj + t_soak):
            phase = "soak"
            day_in_phase = current_day - t_inj
            total_phase_days = t_soak
            cum_steam = self.target_steam_tonnes
            cum_oil = 0.0
        elif current_wc_pct >= self.production_cutoff_wc_pct or current_day > (t_inj + t_soak + self.typical_production_days):
            phase = "idle"
            day_in_phase = max(0.0, current_day - (t_inj + t_soak + self.typical_production_days))
            total_phase_days = 15.0
            cum_steam = self.target_steam_tonnes
            cum_oil = 650.0
        else:
            phase = "production"
            day_in_phase = current_day - (t_inj + t_soak)
            total_phase_days = self.typical_production_days
            cum_steam = self.target_steam_tonnes
            cum_oil = min(800.0, max(10.0, day_in_phase * 7.5))

        pct = min(100.0, max(0.0, (day_in_phase / max(0.1, total_phase_days)) * 100.0))

        return CycleProgress(
            phase=phase,
            cycle_number=self.cycle_number,
            day_in_phase=round(day_in_phase, 1),
            total_phase_days=round(total_phase_days, 1),
            phase_completion_pct=round(pct, 1),
            cum_steam_this_cycle=round(cum_steam, 1),
            cum_oil_this_cycle=round(cum_oil, 1),
        )

    def advance_time(self, dt_days: float, current_wc_pct: float) -> CssCyclePhase:
        """Advances cycle clock and triggers phase transitions."""
        self.day_in_cycle += dt_days
        progress = self.get_progress(self.day_in_cycle, current_wc_pct)
        self.phase = progress.phase
        return self.phase
