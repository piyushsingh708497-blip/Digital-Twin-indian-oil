"""
OIL-TWIN AI - FastAPI Main Application
Baghewala Field Heavy Oil Cyclic Steam Stimulation (CSS) & Sucker Rod Pump (SRP) Digital Twin.
PS SIH26120 — Smart India Hackathon 2026.
"""
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.api import (
    alerts_router,
    audit_router,
    css_router,
    dev_router,
    health_router,
    joint_router,
    recommendations_router,
    srp_router,
    wells_router,
    ws_router,
)
from app.config.settings import settings
from app.db.session import init_db
from app.ml.dyno_classifier import DynoClassifier
from app.ml.failure_model import FailureRiskModel


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan manager for DB table initialization and pre-loading ML models."""
    print(f"[OIL-TWIN AI] Starting backend service v{settings.APP_VERSION} (Mode: {settings.DATA_MODE})...")
    # 1. Initialize SQLite async tables
    await init_db()
    # 2. Warm up ML models
    DynoClassifier()
    FailureRiskModel()
    print("[OIL-TWIN AI] Background initialization complete. Ready for requests.")
    yield
    print("[OIL-TWIN AI] Shutting down.")


app = FastAPI(
    title="OIL-TWIN AI - Well-to-Surface Digital Twin API",
    description=(
        "Coupled AI-enabled digital twin for Cyclic Steam Stimulation (CSS) and Sucker Rod Pump (SRP) "
        "operations on Baghewala Field heavy oil wells (17-19 API). "
        "NOTE: All telemetry and outcomes are generated in simulated data mode."
    ),
    version=settings.APP_VERSION,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS Middleware (allowed origins from settings including http://localhost:5173)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def add_provenance_and_request_id(request: Request, call_next):
    """Adds X-Data-Mode provenance header and X-Request-ID to all HTTP responses."""
    request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
    response = await call_next(request)
    response.headers["X-Data-Mode"] = settings.DATA_MODE
    response.headers["X-Request-ID"] = request_id
    return response


# Register all API routers matching exact data contract
app.include_router(wells_router)
app.include_router(ws_router)
app.include_router(css_router)
app.include_router(srp_router)
app.include_router(joint_router)
app.include_router(recommendations_router)
app.include_router(alerts_router)
app.include_router(audit_router)
app.include_router(health_router)
app.include_router(dev_router)
