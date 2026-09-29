"""
OIL-TWIN AI - Application Settings (pydantic-settings)
Configurable via environment variables or .env file.
"""
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict

from app.config.assumptions import ASSUMPTIONS_HASH


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Core runtime configuration
    ENV: Literal["development", "production", "test"] = "development"
    APP_VERSION: str = "2.0.0-SIH26"
    SEED: int = 42
    WELLS: int = 10
    SIM_SPEED: float = 1.0
    DATA_MODE: Literal["simulated", "scada"] = "simulated"
    DB_URL: str = "sqlite+aiosqlite:///./oil_twin.db"

    # CORS
    CORS_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
    ]

    # Telemetry streaming
    WS_TELEMETRY_INTERVAL_SEC: float = 2.0
    HISTORY_PREGEN_DAYS: int = 30

    # Rate limits (dev and decision routes)
    RATE_LIMIT_DECISIONS_PER_MIN: int = 60
    RATE_LIMIT_DEV_PER_MIN: int = 30

    # Assumptions fingerprint
    ASSUMPTIONS_HASH: str = ASSUMPTIONS_HASH


settings = Settings()
