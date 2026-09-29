"""
OIL-TWIN AI - API Package Export
"""
from app.api.alerts import router as alerts_router
from app.api.audit import router as audit_router
from app.api.css import router as css_router
from app.api.dev import router as dev_router
from app.api.health import router as health_router
from app.api.joint import router as joint_router
from app.api.recommendations import router as recommendations_router
from app.api.srp import router as srp_router
from app.api.telemetry_ws import router as ws_router
from app.api.wells import router as wells_router

__all__ = [
    "alerts_router",
    "audit_router",
    "css_router",
    "dev_router",
    "health_router",
    "joint_router",
    "recommendations_router",
    "srp_router",
    "wells_router",
    "ws_router",
]
