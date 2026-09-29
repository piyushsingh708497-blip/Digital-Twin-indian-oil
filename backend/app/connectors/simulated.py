"""
OIL-TWIN AI - Simulated Data Source Implementation
Implements the DataSource interface using the deterministic multi-well physics engine.
"""
import asyncio
from collections.abc import AsyncIterator
from typing import Any

from app.config.settings import settings
from app.connectors.base import DataSource
from app.schemas import (
    DataHealthResponse,
    FaultInjectionRequest,
    FieldSummary,
    Telemetry,
    Well,
    WellStateResponse,
)
from app.simulator.engine import SimulatorEngine


class SimulatedSource(DataSource):
    """Concrete data source wrapping the physics-inspired Baghewala simulation engine."""

    def __init__(self, engine: SimulatorEngine | None = None):
        self.engine = engine or SimulatorEngine(n_wells=settings.WELLS, seed=settings.SEED)

    async def get_wells(self) -> list[Well]:
        return self.engine.get_wells_summary()

    async def get_well(self, well_id: str) -> Well | None:
        wells = self.engine.get_wells_summary()
        for w in wells:
            if w.id == well_id:
                return w
        return None

    async def get_well_state(self, well_id: str) -> WellStateResponse:
        return self.engine.get_latest_state(well_id)

    async def get_well_history(
        self,
        well_id: str,
        from_ts: str | None = None,
        to_ts: str | None = None,
        step_sec: int | None = None,
    ) -> list[Telemetry]:
        return self.engine.get_history(well_id, from_ts, to_ts, step_sec)

    async def get_telemetry_stream(self, well_id: str) -> AsyncIterator[Telemetry]:
        """Pushes telemetry every ~2s."""
        interval = settings.WS_TELEMETRY_INTERVAL_SEC / max(0.1, settings.SIM_SPEED)
        while True:
            state = self.engine.get_latest_state(well_id)
            yield state.telemetry
            await asyncio.sleep(interval)

    async def get_data_health(self, well_id: str) -> DataHealthResponse:
        return self.engine.get_data_health(well_id)

    async def get_field_summary(self) -> FieldSummary:
        return self.engine.get_field_summary()

    async def inject_fault(self, request: FaultInjectionRequest) -> dict[str, Any]:
        tags = request.tags
        if not tags and request.sensor_tag:
            tags = [request.sensor_tag]
        return self.engine.event_mgr.inject_fault(
            well_id=request.well_id,
            fault_type=request.fault_type,
            tags=tags,
            duration_sec=request.duration_sec or 300,
        )


# Global default instance
default_data_source = SimulatedSource()
