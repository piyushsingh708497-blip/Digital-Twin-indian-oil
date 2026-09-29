// OIL-TWIN AI - Centralized Production API Service
// Matches all 17 backend endpoints exactly without fakes or assumptions

import axios from 'axios';
import type {
  Alert,
  AuditRecord,
  CssForecast,
  CssParams,
  DataHealthResponse,
  Decision,
  DecisionRequest,
  FaultInjectionRequest,
  FaultInjectionResponse,
  FieldSummary,
  HealthResponse,
  JointResponse,
  MetaInfo,
  Recommendation,
  SrpAnalysis,
  SrpSetpoints,
  Telemetry,
  Well,
  WellStateResponse,
} from '../types';

// Central API instance — using relative /api by default for Vite proxy, or fallback to localhost:8000
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// Centralized WebSocket URL generator
export function getTelemetryWsUrl(wellId: string): string {
  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  // If in production or host matches, use window host, otherwise direct to backend port 8000
  if (import.meta.env.VITE_WS_URL) {
    return `${import.meta.env.VITE_WS_URL}/ws/telemetry/${wellId}`;
  }
  return `${wsProtocol}//localhost:8000/ws/telemetry/${wellId}`;
}

// ── 1. Wells & Telemetry Endpoints ───────────────────────────────────────────
export async function getWells(): Promise<Well[]> {
  const response = await apiClient.get<Well[]>('/api/wells');
  return response.data;
}

export async function getWellState(id: string): Promise<WellStateResponse> {
  const response = await apiClient.get<WellStateResponse>(`/api/wells/${id}/state`);
  return response.data;
}

export async function getWellHistory(
  id: string,
  fromTs?: string,
  toTs?: string,
  step?: number
): Promise<Telemetry[]> {
  const params: Record<string, string | number> = {};
  if (fromTs) params.from = fromTs;
  if (toTs) params.to = toTs;
  if (step) params.step = step;

  const response = await apiClient.get<Telemetry[]>(`/api/wells/${id}/history`, { params });
  return response.data;
}

export async function getDataHealth(id: string): Promise<DataHealthResponse> {
  const response = await apiClient.get<DataHealthResponse>(`/api/wells/${id}/data-health`);
  return response.data;
}

// ── 2. Cyclic Steam Stimulation (CSS) ────────────────────────────────────────
export async function forecastCss(id: string, params: CssParams): Promise<CssForecast> {
  const response = await apiClient.post<CssForecast>(`/api/wells/${id}/css/forecast`, params);
  return response.data;
}

// ── 3. Sucker Rod Pump (SRP) ─────────────────────────────────────────────────
export async function analyzeSrp(id: string, setpoints: SrpSetpoints): Promise<SrpAnalysis> {
  const response = await apiClient.post<SrpAnalysis>(`/api/wells/${id}/srp/analysis`, setpoints);
  return response.data;
}

// ── 4. Joint Coupled Optimization ────────────────────────────────────────────
export async function getJointOptimization(id: string): Promise<JointResponse> {
  const response = await apiClient.get<JointResponse>(`/api/wells/${id}/joint`);
  return response.data;
}

// ── 5. AI Recommendations & Decisions ────────────────────────────────────────
export async function getRecommendations(wellId: string): Promise<Recommendation[]> {
  const response = await apiClient.get<Recommendation[]>(`/api/wells/${wellId}/recommendations`);
  return response.data;
}

export async function submitDecision(
  recommendationId: string,
  payload: DecisionRequest
): Promise<Decision> {
  const response = await apiClient.post<Decision>(
    `/api/recommendations/${recommendationId}/decision`,
    payload
  );
  return response.data;
}

// ── 6. Alert Center ──────────────────────────────────────────────────────────
export async function getAlerts(filters?: {
  wellId?: string;
  severity?: string;
  acknowledged?: boolean;
}): Promise<Alert[]> {
  const params: Record<string, string | boolean> = {};
  if (filters?.wellId) params.wellId = filters.wellId;
  if (filters?.severity) params.severity = filters.severity;
  if (typeof filters?.acknowledged === 'boolean') params.acknowledged = filters.acknowledged;

  const response = await apiClient.get<Alert[]>('/api/alerts', { params });
  return response.data;
}

export async function acknowledgeAlert(id: string): Promise<Alert> {
  const response = await apiClient.post<Alert>(`/api/alerts/${id}/acknowledge`);
  return response.data;
}

// ── 7. Audit Trail ───────────────────────────────────────────────────────────
export async function getAuditTrail(filters?: {
  wellId?: string;
  from?: string;
  to?: string;
}): Promise<AuditRecord[]> {
  const params: Record<string, string> = {};
  if (filters?.wellId) params.wellId = filters.wellId;
  if (filters?.from) params.from = filters.from;
  if (filters?.to) params.to = filters.to;

  const response = await apiClient.get<AuditRecord[]>('/api/audit', { params });
  return response.data;
}

// ── 8. Field Summary ─────────────────────────────────────────────────────────
export async function getFieldSummary(): Promise<FieldSummary> {
  const response = await apiClient.get<FieldSummary>('/api/field/summary');
  return response.data;
}

// ── 9. System Health & Metadata ──────────────────────────────────────────────
export async function getHealth(): Promise<HealthResponse> {
  const response = await apiClient.get<HealthResponse>('/api/health');
  return response.data;
}

export async function getMeta(): Promise<MetaInfo> {
  const response = await apiClient.get<MetaInfo>('/api/meta');
  return response.data;
}

// ── 10. Dev Fault Injection ──────────────────────────────────────────────────
export async function injectFault(
  payload: FaultInjectionRequest
): Promise<FaultInjectionResponse> {
  const response = await apiClient.post<FaultInjectionResponse>('/api/dev/faults', payload);
  return response.data;
}
