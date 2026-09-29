// OIL-TWIN AI - Settings, System Health & Simulation Provenance Page
// Includes Developer Fault Injection Console and Clear Simulation Transparency Disclaimers
import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Bug,
  CheckCircle2,
  Cpu,
  Info,
  Play,
  Server,
  Settings as SettingsIcon,
} from 'lucide-react';
import { getHealth, getMeta, injectFault } from '../services/api';
import { useAppStore } from '../store/useAppStore';
import { LoadingSkeleton } from '../components/ui/FeedbackStates';
import type { FaultInjectionRequest } from '../types';

export const Settings: React.FC = () => {
  const { selectedWellId } = useAppStore();
  const queryClient = useQueryClient();

  // Developer fault injection form state
  const [faultType, setFaultType] = useState<string>('sensor_dropout');
  const [sensorTag, setSensorTag] = useState<string>('wellbore_bht');
  const [durationSec, setDurationSec] = useState<number>(120);
  const [injectionSuccess, setInjectionSuccess] = useState<string | null>(null);

  // Fetch Meta
  const { data: meta, isLoading: isMetaLoading } = useQuery({
    queryKey: ['meta'],
    queryFn: getMeta,
  });

  // Fetch Health
  const { data: health, isLoading: isHealthLoading } = useQuery({
    queryKey: ['health'],
    queryFn: getHealth,
  });

  // Fault mutation
  const faultMutation = useMutation({
    mutationFn: (req: FaultInjectionRequest) => injectFault(req),
    onSuccess: (res) => {
      setInjectionSuccess(`Fault '${res.faultType}' injected on ${res.wellId || selectedWellId} for ${res.durationSec}s`);
      queryClient.invalidateQueries({ queryKey: ['wellState', selectedWellId] });
      queryClient.invalidateQueries({ queryKey: ['dataHealth', selectedWellId] });
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    },
  });

  const handleInject = (e: React.FormEvent) => {
    e.preventDefault();
    setInjectionSuccess(null);
    faultMutation.mutate({
      wellId: selectedWellId,
      faultType,
      sensorTag: faultType === 'sensor_dropout' ? sensorTag : undefined,
      durationSec,
    });
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="p-4 rounded-xl bg-white border border-[#E2E5E9] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono font-bold text-amber-700 uppercase tracking-widest">
              SYSTEM CONFIGURATION & PROVENANCE
            </span>
            <span className="text-[10px] font-mono bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-md font-semibold">
              SIMULATION TRANSPARENCY
            </span>
          </div>
          <h1 className="text-lg font-bold text-slate-900 tracking-wide flex items-center gap-2">
            <SettingsIcon className="w-5 h-5 text-slate-600" />
            System Metadata, Diagnostics & Provenance
          </h1>
          <p className="text-xs text-slate-500 font-mono mt-0.5">
            Oil India Limited SIH26120 • Baghewala Heavy Oil Well-to-Surface Digital Twin
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-[#F8F9FA] rounded-lg border border-[#E2E5E9] text-xs font-mono text-slate-700 flex items-center gap-2">
            <Server className="w-3.5 h-3.5 text-emerald-600" />
            <span>Service: {health?.status === 'ok' ? 'HEALTHY' : 'CONNECTING'}</span>
          </div>
        </div>
      </div>

      {/* ════ 1. CRITICAL SIMULATION TRANSPARENCY NOTICE ════ */}
      <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 space-y-2.5 shadow-xs">
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <h2 className="text-xs font-bold text-amber-900 uppercase tracking-wider font-mono">
            Mandatory Simulation Provenance & Scientific Disclosure
          </h2>
        </div>

        <div className="text-xs text-slate-700 space-y-1.5 leading-relaxed font-sans">
          <p>
            • <b className="text-slate-900">Simulated Telemetry:</b> All high-frequency telemetry streaming across the WebSocket and REST interfaces is generated via physics-based numerical surrogates (coupled Boberg-Lundberg thermal models and discretized 1D damped wave equations).
          </p>
          <p>
            • <b className="text-slate-900">Machine Learning Models:</b> Classification models (dyno card diagnosis) and regression models (rod failure precursor prediction) have been trained and evaluated strictly on synthetic numerical distributions reflecting Baghewala field reservoir characteristics (17-19° API crude, low GOR, 46-48°C initial temp).
          </p>
          <p>
            • <b className="text-slate-900">Field Validation Status:</b> Direct operational field validation against physical SCADA RTUs at Baghewala Field has <b>not</b> occurred during this hackathon development phase. SCADA OPC-UA integration is planned for subsequent commercialization phases.
          </p>
        </div>
      </div>

      {/* ════ 2. SYSTEM HEALTH & LOADED AI MODELS ════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Model Registry & Capabilities */}
        <div className="bg-white border border-[#E2E5E9] rounded-xl p-5 space-y-4 shadow-xs">
          <div className="flex items-center gap-2 pb-3 border-b border-[#E2E5E9]">
            <Cpu className="w-4 h-4 text-blue-600" />
            <span className="text-xs font-bold text-slate-900 uppercase tracking-wider font-mono">
              Loaded AI & Physics Models
            </span>
          </div>

          {isMetaLoading ? (
            <LoadingSkeleton rows={3} height="h-16" />
          ) : meta ? (
            <div className="space-y-3 text-xs font-mono">
              <div className="space-y-2">
                {meta.availableModels?.map((model: string) => (
                  <div
                    key={model}
                    className="p-3 bg-[#F8F9FA] border border-[#E2E5E9] rounded-lg flex items-center justify-between shadow-2xs"
                  >
                    <span className="text-slate-900 font-semibold">{model}</span>
                    <span className="text-[10px] text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md font-bold">
                      ACTIVE
                    </span>
                  </div>
                ))}
              </div>

              <div className="pt-3 border-t border-[#E2E5E9] text-[11px] text-slate-500 space-y-1">
                <div className="flex justify-between">
                  <span>Backend Version:</span>
                  <span className="text-slate-900 font-bold">{meta.version || meta.applicationVersion}</span>
                </div>
                <div className="flex justify-between">
                  <span>Assumptions Hash:</span>
                  <span className="text-amber-700 font-semibold">{meta.assumptionsHash?.slice(0, 16) || '—'}</span>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* Backend Components Health */}
        <div className="bg-white border border-[#E2E5E9] rounded-xl p-5 space-y-4 shadow-xs">
          <div className="flex items-center gap-2 pb-3 border-b border-[#E2E5E9]">
            <Server className="w-4 h-4 text-emerald-600" />
            <span className="text-xs font-bold text-slate-900 uppercase tracking-wider font-mono">
              Backend Service Health
            </span>
          </div>

          {isHealthLoading ? (
            <LoadingSkeleton rows={3} height="h-16" />
          ) : health ? (
            <div className="space-y-3 text-xs font-mono">
              {Object.entries(health.components || {}).map(([compName, compHealth]) => (
                <div
                  key={compName}
                  className="p-3 bg-[#F8F9FA] border border-[#E2E5E9] rounded-lg flex items-center justify-between shadow-2xs"
                >
                  <div>
                    <span className="text-slate-900 font-bold block">{compName}</span>
                    {compHealth.details && (
                      <span className="text-[10px] text-slate-500">
                        {JSON.stringify(compHealth.details)}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md font-bold uppercase">
                    {compHealth.status}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {/* ════ 3. DEVELOPER FAULT INJECTION CONSOLE ════ */}
      <div className="bg-white border border-[#E2E5E9] rounded-xl p-5 space-y-4 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-[#E2E5E9]">
          <div className="flex items-center gap-2">
            <Bug className="w-4 h-4 text-amber-600" />
            <span className="text-xs font-bold text-slate-900 uppercase tracking-wider font-mono">
              Developer Fault Injection & Stress Testing Console
            </span>
          </div>
          <span className="text-[10px] font-mono bg-[#F1F3F5] text-slate-700 px-2.5 py-0.5 rounded-md border border-[#E2E5E9] font-medium">
            Target Well: {selectedWellId}
          </span>
        </div>

        <p className="text-xs text-slate-600">
          Simulate abnormal physical conditions or sensor failures to verify live AI anomaly detection and graceful UI degradation.
        </p>

        <form onSubmit={handleInject} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          {/* Fault Type */}
          <div>
            <label className="input-label">Fault Condition</label>
            <select
              value={faultType}
              onChange={(e) => setFaultType(e.target.value)}
              className="input-field font-mono text-xs cursor-pointer"
            >
              <option value="sensor_dropout">Sensor Dropout (Missing Tag)</option>
              <option value="stale_telemetry">Stale Telemetry (Buffer Freeze)</option>
              <option value="abnormal_rod_load">Abnormal Rod Load (High Tension)</option>
              <option value="high_water_cut">Rapid Water Cut Spike (Water Influx)</option>
              <option value="communication_loss">Communication Loss (Network Dropout)</option>
            </select>
          </div>

          {/* Target Sensor Tag */}
          <div>
            <label className="input-label">Target Transmitter Tag</label>
            <select
              value={sensorTag}
              onChange={(e) => setSensorTag(e.target.value)}
              disabled={faultType !== 'sensor_dropout'}
              className="input-field font-mono text-xs cursor-pointer disabled:opacity-40"
            >
              <option value="wellbore_bht">wellbore_bht (Bottomhole Temp)</option>
              <option value="wellbore_bhp">wellbore_bhp (Bottomhole Pressure)</option>
              <option value="srp_rod_load_max">srp_rod_load_max (Load Cell)</option>
              <option value="surface_oil_rate">surface_oil_rate (Coriolis Meter)</option>
              <option value="css_steam_rate">css_steam_rate (Steam Orifice)</option>
            </select>
          </div>

          {/* Duration */}
          <div>
            <label className="input-label">Duration (Seconds)</label>
            <input
              type="number"
              min="10"
              max="600"
              step="10"
              value={durationSec}
              onChange={(e) => setDurationSec(Number(e.target.value))}
              className="input-field font-mono text-xs"
            />
          </div>

          {/* Trigger Button */}
          <div>
            <button
              type="submit"
              disabled={faultMutation.isPending}
              className="w-full btn-danger text-xs justify-center py-2 flex items-center gap-1.5"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              {faultMutation.isPending ? 'Injecting Fault...' : 'Inject Fault Scenario'}
            </button>
          </div>
        </form>

        {injectionSuccess && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-mono text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{injectionSuccess}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default Settings;
