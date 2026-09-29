"""
OIL-TWIN AI - Well Schema
Exact contract: Well { id, name, status, cssCyclePhase, cycleNumber }
"""
from app.schemas.common import CamelModel, CssCyclePhase


class Well(CamelModel):
    id: str
    name: str
    status: str
    css_cycle_phase: CssCyclePhase
    cycle_number: int
