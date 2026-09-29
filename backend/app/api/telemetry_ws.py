"""
OIL-TWIN AI - Real-Time Telemetry WebSocket
WS /ws/telemetry/{id}
Pushes Telemetry JSON every ~2s matching exact schema contract.
"""
import asyncio
import json

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.config.settings import settings
from app.connectors.simulated import default_data_source

router = APIRouter(tags=["WebSocket"])


@router.websocket("/ws/telemetry/{id}")
async def telemetry_websocket(websocket: WebSocket, id: str):
    """Pushes live telemetry frames every ~2s matching exact contract."""
    await websocket.accept()
    interval = settings.WS_TELEMETRY_INTERVAL_SEC / max(0.1, settings.SIM_SPEED)

    try:
        while True:
            try:
                state = await default_data_source.get_well_state(id)
                # Send exact camelCase Telemetry JSON
                payload = state.telemetry.model_dump(by_alias=True)
                await websocket.send_text(json.dumps(payload))
            except KeyError:
                await websocket.send_text(json.dumps({"error": f"Well '{id}' not found"}))
                break

            await asyncio.sleep(interval)
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
