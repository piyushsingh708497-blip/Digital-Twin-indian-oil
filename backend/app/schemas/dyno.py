"""
OIL-TWIN AI - DynoCard Schema
Exact contract:
DynoCard { surface:[{position, load}], downhole:[{position, load}], diagnosis, confidence }
"""

from app.schemas.common import CamelModel, DynoDiagnosis


class DynoPoint(CamelModel):
    position: float
    load: float


class DynoCard(CamelModel):
    surface: list[DynoPoint]
    downhole: list[DynoPoint]
    diagnosis: DynoDiagnosis
    confidence: float
