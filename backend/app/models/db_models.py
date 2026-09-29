"""
OIL-TWIN AI - SQLAlchemy ORM Models
Synthetic Demonstration Dataset - Not OIL Confidential Data
"""
from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class Well(Base):
    __tablename__ = "wells"

    id = Column(Integer, primary_key=True, index=True)
    well_id = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    field = Column(String, default="Baghewala")
    latitude = Column(Float)
    longitude = Column(Float)
    depth_m = Column(Float)  # Total depth in meters
    spud_date = Column(String)
    status = Column(String, default="Active")  # Active, Inactive, Maintenance
    health_status = Column(String, default="Healthy")  # Healthy, Warning, Critical
    health_score = Column(Float, default=100.0)
    created_at = Column(DateTime, server_default=func.now())

    telemetry = relationship("Telemetry", back_populates="well")
    css_cycles = relationship("CSSCycle", back_populates="well")
    srp_operations = relationship("SRPOperation", back_populates="well")
    production_history = relationship("ProductionHistory", back_populates="well")
    equipment_events = relationship("EquipmentEvent", back_populates="well")
    alerts = relationship("Alert", back_populates="well")


class Telemetry(Base):
    __tablename__ = "telemetry"

    id = Column(Integer, primary_key=True, index=True)
    well_id = Column(Integer, ForeignKey("wells.id"))
    timestamp = Column(DateTime, server_default=func.now())

    # Reservoir parameters
    reservoir_temp_c = Column(Float)       # Celsius
    reservoir_pressure_kpa = Column(Float) # kPa
    oil_viscosity_cp = Column(Float)       # centipoise
    water_saturation = Column(Float)       # fraction 0-1
    permeability_md = Column(Float)        # millidarcy

    # Wellbore parameters
    wellbore_temp_c = Column(Float)
    wellbore_pressure_kpa = Column(Float)
    flow_rate_m3d = Column(Float)          # m³/day

    # CSS parameters
    steam_volume_m3 = Column(Float)        # m³ per cycle
    injection_pressure_kpa = Column(Float) # kPa
    steam_quality = Column(Float)          # fraction 0-1
    soak_time_days = Column(Float)
    css_cycle_number = Column(Integer)

    # SRP parameters
    stroke_length_m = Column(Float)        # meters
    spm = Column(Float)                    # strokes per minute
    vfd_hz = Column(Float)                 # Hz
    pump_efficiency_pct = Column(Float)    # %
    rod_load_kn = Column(Float)            # kN

    # Production
    oil_rate_m3d = Column(Float)           # m³/day
    water_rate_m3d = Column(Float)
    gas_rate_m3d = Column(Float)
    gor = Column(Float)                    # gas-oil ratio m³/m³

    # Energy
    energy_kwh = Column(Float)             # total energy kWh/day
    energy_per_barrel_kwh = Column(Float)  # kWh per barrel
    steam_oil_ratio = Column(Float)        # SOR m³/m³

    well = relationship("Well", back_populates="telemetry")


class CSSCycle(Base):
    __tablename__ = "css_cycles"

    id = Column(Integer, primary_key=True, index=True)
    well_id = Column(Integer, ForeignKey("wells.id"))
    cycle_number = Column(Integer)
    start_date = Column(String)

    # Injection phase
    steam_volume_m3 = Column(Float)
    injection_pressure_kpa = Column(Float)
    injection_duration_days = Column(Float)
    steam_quality = Column(Float)

    # Soak phase
    soak_time_days = Column(Float)

    # Production phase
    production_duration_days = Column(Float)
    peak_oil_rate_m3d = Column(Float)
    total_oil_m3 = Column(Float)
    production_cutoff_m3d = Column(Float)

    # Performance
    sor = Column(Float)
    energy_kwh = Column(Float)
    reservoir_temp_peak_c = Column(Float)

    well = relationship("Well", back_populates="css_cycles")


class SRPOperation(Base):
    __tablename__ = "srp_operations"

    id = Column(Integer, primary_key=True, index=True)
    well_id = Column(Integer, ForeignKey("wells.id"))
    timestamp = Column(DateTime, server_default=func.now())

    stroke_length_m = Column(Float)
    spm = Column(Float)
    vfd_hz = Column(Float)
    pump_efficiency_pct = Column(Float)
    rod_load_kn = Column(Float)
    torque_nm = Column(Float)

    # Risk indicators
    rod_floating_risk = Column(Float, default=0.0)  # 0-100
    impact_loading_risk = Column(Float, default=0.0)
    pump_unsetting_risk = Column(Float, default=0.0)
    rod_failure_risk = Column(Float, default=0.0)

    well = relationship("Well", back_populates="srp_operations")


class ProductionHistory(Base):
    __tablename__ = "production_history"

    id = Column(Integer, primary_key=True, index=True)
    well_id = Column(Integer, ForeignKey("wells.id"))
    date = Column(String, index=True)

    oil_rate_m3d = Column(Float)
    water_rate_m3d = Column(Float)
    gas_rate_m3d = Column(Float)
    reservoir_temp_c = Column(Float)
    viscosity_cp = Column(Float)
    steam_injected_m3 = Column(Float)
    energy_kwh = Column(Float)
    sor = Column(Float)
    css_cycle_number = Column(Integer)

    well = relationship("Well", back_populates="production_history")


class EquipmentEvent(Base):
    __tablename__ = "equipment_events"

    id = Column(Integer, primary_key=True, index=True)
    well_id = Column(Integer, ForeignKey("wells.id"))
    timestamp = Column(DateTime, server_default=func.now())
    event_type = Column(String)  # rod_floating, pump_unsetting, rod_failure, impact_loading
    severity = Column(String)    # Low, Medium, High, Critical
    description = Column(Text)
    resolved = Column(Boolean, default=False)
    resolution_notes = Column(Text)

    well = relationship("Well", back_populates="equipment_events")


class Prediction(Base):
    __tablename__ = "predictions"

    id = Column(Integer, primary_key=True, index=True)
    well_id = Column(Integer, ForeignKey("wells.id"))
    timestamp = Column(DateTime, server_default=func.now())
    prediction_type = Column(String)  # production, temperature, risk
    input_params = Column(JSON)
    predicted_value = Column(Float)
    confidence = Column(Float)
    model_version = Column(String, default="v1.0-synthetic")


class Simulation(Base):
    __tablename__ = "simulations"

    id = Column(Integer, primary_key=True, index=True)
    well_id = Column(String, index=True)
    timestamp = Column(DateTime, server_default=func.now())
    scenario_name = Column(String)
    input_params = Column(JSON)
    results = Column(JSON)
    is_optimization = Column(Boolean, default=False)


class OptimizationRun(Base):
    __tablename__ = "optimization_runs"

    id = Column(Integer, primary_key=True, index=True)
    well_id = Column(String, index=True)
    timestamp = Column(DateTime, server_default=func.now())
    best_params = Column(JSON)
    best_score = Column(Float)
    all_scenarios = Column(JSON)
    explanation = Column(JSON)


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True)
    well_id = Column(Integer, ForeignKey("wells.id"))
    timestamp = Column(DateTime, server_default=func.now())
    alert_type = Column(String)   # warning, critical, info
    category = Column(String)     # equipment, css, srp, production, energy
    title = Column(String)
    message = Column(Text)
    acknowledged = Column(Boolean, default=False)
    resolved = Column(Boolean, default=False)
    resolved_at = Column(DateTime)

    well = relationship("Well", back_populates="alerts")
