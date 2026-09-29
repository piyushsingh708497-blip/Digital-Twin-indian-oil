"""
OIL-TWIN AI - Common Schema Definitions & Base Model
Ensures exact camelCase serialization for the React frontend contract.
"""
from typing import Literal

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    """Base model that automatically aliases snake_case Python attributes to camelCase JSON."""
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
        protected_namespaces=(),
    )


CssCyclePhase = Literal['injection', 'soak', 'production', 'idle']

DynoDiagnosis = Literal[
    'normal',
    'rod_floating',
    'fluid_pound',
    'gas_interference',
    'pump_unseating_risk',
    'tagging',
]

RecoType = Literal['css', 'srp', 'joint']

RecoStatus = Literal['pending', 'accepted', 'rejected', 'modified']

AlertSeverity = Literal['info', 'warn', 'critical']

AlertKind = Literal[
    'rod_failure_risk',
    'rod_floating',
    'impact_loading',
    'pump_unsetting',
    'high_sor',
    'sensor_fault',
    'data_stale',
]

DecisionType = Literal['accepted', 'rejected', 'modified']

TagQualityStatus = Literal['ok', 'stale', 'bad', 'missing']

DataMode = Literal['simulated', 'scada']
