"""
OIL-TWIN AI - Abstract Data Source Interface
Defines the contract for telemetry ingestion, enabling plug-and-play SCADA replacement.
"""
from abc import ABC, abstractmethod
from collections.abc import AsyncIterator
from typing import Any

from app.schemas import (
    DataHealthResponse,
    FaultInjectionRequest,
    FieldSummary,
    Telemetry,
    Well,
    WellStateResponse,
)


class DataSource(ABC):
    """Abstract interface for all well and telemetry data sources (Simulated, SCADA, Historian)."""

    @abstractmethod
    async def get_wells(self) -> list[Well]:
        """Return list of all monitored wells in the field."""

    @abstractmethod
    async def get_well(self, well_id: str) -> Well | None:
        """Return metadata for a specific well."""

    @abstractmethod
    async def get_well_state(self, well_id: str) -> WellStateResponse:
        """Return the latest combined state: Telemetry + DynoCard + active alerts."""

    @abstractmethod
    async def get_well_history(
        self,
        well_id: str,
        from_ts: str | None = None,
        to_ts: str | None = None,
        step_sec: int | None = None,
    ) -> list[Telemetry]:
        """Return historical telemetry timeseries for replay scrubber."""

    @abstractmethod
    async def get_telemetry_stream(self, well_id: str) -> AsyncIterator[Telemetry]:
        """Async generator yielding live telemetry points at regular intervals (~2s)."""

    @abstractmethod
    async def get_data_health(self, well_id: str) -> DataHealthResponse:
        """Return tag health, staleness, and missing sensor diagnosis."""

    @abstractmethod
    async def get_field_summary(self) -> FieldSummary:
        """Return aggregate field-level metrics: total oil, field SOR, wells at risk."""

    @abstractmethod
    async def inject_fault(self, request: FaultInjectionRequest) -> dict[str, Any]:
        """Inject or clear a simulated sensor fault / stale data for testing/demo."""
