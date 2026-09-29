"""
OIL-TWIN AI - SCADA Data Source Connector (Field Deployment Stub)
Typed stub adhering to DataSource interface. To be connected to OIL's Baghewala OPC-UA / MQTT gateway.
"""
from collections.abc import AsyncIterator
from typing import Any

from app.connectors.base import DataSource
from app.schemas import (
    DataHealthResponse,
    FaultInjectionRequest,
    FieldSummary,
    Telemetry,
    Well,
    WellStateResponse,
)


class ScadaSource(DataSource):
    """
    SCADA / Historian data source connecting to actual field telemetry tags via OPC-UA / Modbus / MQTT.
    Unimplemented stub for hackathon demonstration; will be swapped in production.
    """

    def __init__(self, endpoint_url: str = "opc.tcp://scada.baghewala.oilindia.in:4840"):
        self.endpoint_url = endpoint_url

    async def get_wells(self) -> list[Well]:
        raise NotImplementedError("ScadaSource requires live field connection to Baghewala SCADA server.")

    async def get_well(self, well_id: str) -> Well | None:
        raise NotImplementedError("ScadaSource requires live field connection to Baghewala SCADA server.")

    async def get_well_state(self, well_id: str) -> WellStateResponse:
        raise NotImplementedError("ScadaSource requires live field connection to Baghewala SCADA server.")

    async def get_well_history(
        self,
        well_id: str,
        from_ts: str | None = None,
        to_ts: str | None = None,
        step_sec: int | None = None,
    ) -> list[Telemetry]:
        raise NotImplementedError("ScadaSource requires live connection to field historian.")

    async def get_telemetry_stream(self, well_id: str) -> AsyncIterator[Telemetry]:
        raise NotImplementedError("ScadaSource requires live field telemetry stream.")
        yield  # type: ignore

    async def get_data_health(self, well_id: str) -> DataHealthResponse:
        raise NotImplementedError("ScadaSource requires connection to SCADA tag diagnostics.")

    async def get_field_summary(self) -> FieldSummary:
        raise NotImplementedError("ScadaSource requires field aggregator.")

    async def inject_fault(self, request: FaultInjectionRequest) -> dict[str, Any]:
        raise NotImplementedError("Fault injection is disabled on real SCADA systems.")
