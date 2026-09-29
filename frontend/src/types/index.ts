// OIL-TWIN AI - Complete Frontend Type Definitions
// Exactly aligned with FastAPI backend camelCase JSON contracts

export type CssCyclePhase = 'injection' | 'soak' | 'production' | 'idle';

export type DynoDiagnosis =
  | 'normal'
  | 'rod_floating'
  | 'fluid_pound'
  | 'gas_interference'
  | 'pump_unseating_risk'
  | 'tagging';

export type RecoType = 'css' | 'srp' | 'joint';
export type RecoStatus = 'pending' | 'accepted' | 'rejected' | 'modified';
export type DecisionType = 'accepted' | 'rejected' | 'modified';

export type AlertSeverity = 'info' | 'warn' | 'critical';
export type AlertKind =
  | 'rod_failure_risk'
  | 'rod_floating'
  | 'impact_loading'
  | 'pump_unsetting'
  | 'high_sor'
  | 'sensor_fault'
  | 'data_stale'
  | string;

export type TagQualityStatus = 'ok' | 'stale' | 'bad' | 'missing';
export type OverallQuality = 'good' | 'degraded' | 'critical';
export type DataMode = 'simulated' | 'scada';

export interface DataHealthResponse {
  wellId: string;
  healthy: boolean;
  dataAgeSec: number;
  tagStatus: Record<string, TagQualityStatus>;
  missingSensors: string[];
  overallQuality: OverallQuality;
  warnings: string[];
}

// ── Wells ────────────────────────────────────────────────────────────────────
export interface Well {
  id: string;
  name: string;
  status: string;
  cssCyclePhase: CssCyclePhase;
  cycleNumber: number;
}

// ── Telemetry (Nested camelCase contract) ────────────────────────────────────
export interface ReservoirTelemetry {
  pressure: number;
  temperature: number;
}

export interface WellboreTelemetry {
  bhp: number;
  bht: number;
  fluidLevel: number;
  steamQuality: number;
}

export interface CssTelemetry {
  steamRate: number;
  injPressure: number;
  cumSteam: number;
  soakDay: number;
}

export interface SrpTelemetry {
  strokeLength: number;
  spm: number;
  vfdHz: number;
  rodLoadMax: number;
  rodLoadMin: number;
  motorAmps: number;
  kW: number;
  pumpFillagePct: number;
}

export interface SurfaceTelemetry {
  wellheadPressure: number;
  wellheadTemp: number;
  flowRate: number;
  waterCutPct: number;
  oilRate: number;
}

export interface DerivedTelemetry {
  sor?: number | null;
  kWhPerBbl?: number | null;
}

export interface QualityTelemetry {
  tagStatus: Record<string, TagQualityStatus>;
  dataAgeSec: number;
}

export interface Telemetry {
  ts: string;
  reservoir: ReservoirTelemetry;
  wellbore: WellboreTelemetry;
  css: CssTelemetry;
  srp: SrpTelemetry;
  surface: SurfaceTelemetry;
  derived: DerivedTelemetry;
  quality: QualityTelemetry;
}

// ── Dynamometer Card ─────────────────────────────────────────────────────────
export interface DynoPoint {
  position: number;
  load: number;
}

export interface DynoCard {
  surface: DynoPoint[];
  downhole: DynoPoint[];
  diagnosis: DynoDiagnosis;
  confidence: number;
}

// ── Well State Response ──────────────────────────────────────────────────────
export interface WellStateResponse {
  wellId: string;
  telemetry: Telemetry;
  dynoCard: DynoCard;
  activeAlerts: Alert[];
}

// ── CSS Forecast ─────────────────────────────────────────────────────────────
export interface CssParams {
  steamVolumeTonnes: number;
  injPressure: number;
  soakDays: number;
  productionCutoffWaterCut: number;
}

export interface OilRateCurvePoint {
  day: number;
  p10: number;
  p50: number;
  p90: number;
}

export interface UncertaintyBand {
  p10: number;
  p50: number;
  p90: number;
}

export interface CssForecast {
  params: CssParams;
  oilRateCurve: OilRateCurvePoint[];
  cumOil: number;
  sor: number;
  energyCost: number;
  band: UncertaintyBand;
}

// ── SRP Analysis ─────────────────────────────────────────────────────────────
export interface SrpSetpoints {
  strokeLength: number;
  spm: number;
  vfdHz: number;
}

export interface SrpAnalysis {
  setpoints: SrpSetpoints;
  predictedOilRate: number;
  rodStressPct: number;
  kW: number;
  failureRisk: number;
  dynoCard: DynoCard;
  warnings: string[];
}

// ── Joint Optimization ───────────────────────────────────────────────────────
export interface JointBaseline {
  cssParams: CssParams;
  srpSetpoints: SrpSetpoints;
  oilRate: number;
  sor: number;
  kWhPerBbl: number;
  rodStressPct: number;
  failureRisk: number;
}

export interface JointOptimized {
  cssParams: CssParams;
  srpSetpoints: SrpSetpoints;
  oilRate: number;
  sor: number;
  kWhPerBbl: number;
  rodStressPct: number;
  failureRisk: number;
  oilUpliftPct: number;
  sorReductionPct: number;
  energySavingPct: number;
}

export interface ParetoPoint {
  oil: number;
  energy: number;
  risk: number;
  cssParams: CssParams;
  srpSetpoints: SrpSetpoints;
}

export interface JointResponse {
  baselineSeparate: JointBaseline;
  jointOptimized: JointOptimized;
  pareto: ParetoPoint[];
}

// ── Recommendations & Decisions ──────────────────────────────────────────────
export interface ExpectedGain {
  oilBblPerDay: number;
  sorDelta: number;
  kWhDelta: number;
}

export interface RecoDriver {
  feature: string;
  contribution: number;
}

export interface Recommendation {
  id: string;
  wellId: string;
  type: RecoType;
  current: Record<string, any>;
  proposed: Record<string, any>;
  expectedGain: ExpectedGain;
  riskScore: number;
  confidence: number;
  reasoning: string[];
  drivers: RecoDriver[];
  status: RecoStatus;
  createdAt: string;
}

export interface DecisionRequest {
  decision: DecisionType;
  reason: string;
  modifiedValues?: Record<string, any> | null;
  decidedBy?: string;
}

export interface Decision {
  id: string;
  recommendationId: string;
  decision: DecisionType;
  reason: string;
  modifiedValues?: Record<string, any> | null;
  decidedBy: string;
  decidedAt: string;
}

// ── Alerts ───────────────────────────────────────────────────────────────────
export interface Alert {
  id: string;
  wellId: string;
  severity: AlertSeverity;
  kind: AlertKind;
  probability: number;
  timeToEventHrs?: number | null;
  message: string;
  acknowledged: boolean;
  createdAt: string;
}

// ── Data Health ──────────────────────────────────────────────────────────────
export interface DataHealthResponse {
  wellId: string;
  healthy: boolean;
  dataAgeSec: number;
  tagStatus: Record<string, TagQualityStatus>;
  missingSensors: string[];
  overallQuality: OverallQuality;
  warnings: string[];
}

// ── Field Summary ────────────────────────────────────────────────────────────
export interface FieldSummary {
  totalWells: number;
  activeWells: number;
  totalOilRate: number;
  fieldSor: number;
  kWhPerBbl: number;
  wellsAtRisk: number;
  steamInjectedToday: number;
  baselineVsTwinImpact: Record<string, number>;
}

// ── Metadata & Provenance ────────────────────────────────────────────────────
export interface MetaInfo {
  applicationVersion: string;
  apiVersion: string;
  dataMode: DataMode;
  simulation: boolean;
  fieldValidated: boolean;
  availableModels: string[];
  modelStatus: Record<string, string>;
  capabilities: string[];
  limitations: string[];
  assumptionsHash: string;
  seed: number;
  version: string;
}

// ── Audit ────────────────────────────────────────────────────────────────────
export interface AuditRecord {
  id: string;
  wellId?: string | null;
  eventType: string;
  details: Record<string, any>;
  createdAt: string;
}

// ── Dev Fault Injection ──────────────────────────────────────────────────────
export interface FaultInjectionRequest {
  wellId: string;
  faultType: string;
  sensorTag?: string | null;
  tags?: string[] | null;
  durationSec?: number;
}

export interface FaultInjectionResponse {
  status: string;
  wellId: string;
  faultType: string;
  tags: string[];
  durationSec: number;
}

// ── System Health ────────────────────────────────────────────────────────────
export interface ComponentHealth {
  status: string;
  details?: Record<string, any> | null;
}

export interface HealthResponse {
  status: string;
  service: string;
  version: string;
  timestamp: string;
  simulation: boolean;
  dataMode: string;
  components: Record<string, ComponentHealth>;
}
