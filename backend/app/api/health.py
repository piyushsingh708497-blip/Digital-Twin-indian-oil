"""
OIL-TWIN AI - Health, Field Summary, and Metadata API
GET /api/health
GET /api/field/summary
GET /api/meta
"""
from datetime import datetime, timezone

from fastapi import APIRouter, Response

from app.config.assumptions import ASSUMPTIONS_HASH
from app.config.settings import settings
from app.connectors.simulated import default_data_source
from app.schemas.meta import ComponentHealth, FieldSummary, HealthResponse, MetaInfo

router = APIRouter(tags=["Health & Field"])


@router.get("/api/health", response_model=HealthResponse)
async def health_check():
    """System health check and component status."""
    return HealthResponse(
        status="ok",
        service="OIL-TWIN AI Backend",
        version=settings.APP_VERSION,
        timestamp=datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        simulation=True,
        data_mode=settings.DATA_MODE,
        components={
            "simulator": ComponentHealth(status="healthy", details={"wells": settings.WELLS, "seed": settings.SEED}),
            "twinModels": ComponentHealth(status="loaded", details={"css": "Boberg-Lundberg", "srp": "1D Wave Vectorized"}),
            "mlDiagnostics": ComponentHealth(status="ready", details={"dynoClasses": 6, "anomalyDetector": "active"}),
            "database": ComponentHealth(status="connected", details={"engine": "sqlite+aiosqlite"}),
        },
    )


@router.get("/api/field/summary", response_model=FieldSummary)
async def get_field_summary(response: Response):
    """Aggregated field metrics: total oil, field SOR, kWh/bbl, wells at risk, steam injected today."""
    response.headers["X-Data-Mode"] = "simulated"
    return await default_data_source.get_field_summary()


@router.get("/api/meta", response_model=MetaInfo)
async def get_metadata(response: Response):
    """
    Provenance metadata: applicationVersion, apiVersion, dataMode, simulation,
    fieldValidated, availableModels, modelStatus, capabilities, limitations.
    Clearly signals simulated data mode.
    """
    response.headers["X-Data-Mode"] = "simulated"
    return MetaInfo(
        application_version=settings.APP_VERSION,
        api_version="v1",
        data_mode="simulated",
        simulation=True,
        field_validated=False,
        available_models=[
            "DynoCardClassifier_RF",
            "RodFailurePredictor_GB",
            "BobergLundbergCssTwin",
            "VectorizedWaveSrpTwin",
            "CoupledThermalDrawdownTwin",
        ],
        model_status={
            "dynoClassifier": "trained_and_validated",
            "failurePredictor": "trained_and_validated",
            "coupledTwin": "active",
        },
        capabilities=[
            "Cyclic Steam Stimulation (CSS) 4-phase cycle simulation",
            "Vectorized 1D damped wave SRP mechanics dynamometer card synthesis",
            "Bidirectional reservoir-wellbore-pump physics coupling",
            "Multi-objective joint CSS+SRP Pareto optimization",
            "Explainable AI recommendation engine with feature contributions",
            "High-frequency telemetry WebSocket streaming (~2s)",
            "Append-only decision audit logging",
        ],
        limitations=[
            "Telemetry is simulated; real Baghewala field/SCADA data unavailable during development",
            "ML models trained and evaluated on physics-inspired synthetic distributions",
            "Not field validated; operational deployment requires real well sensor calibration",
            "Walther-Andrade viscosity coefficients are engineering approximations",
        ],
        assumptions_hash=ASSUMPTIONS_HASH,
        seed=settings.SEED,
        version=settings.APP_VERSION,
    )

