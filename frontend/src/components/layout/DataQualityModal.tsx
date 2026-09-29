import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  X,
  ShieldCheck,
  Database,
} from 'lucide-react';
import { getDataHealth } from '../../services/api';
import { useAppStore } from '../../store/useAppStore';

interface DataQualityModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DataQualityModal: React.FC<DataQualityModalProps> = ({ isOpen, onClose }) => {
  const { selectedWellId, lastTelemetry, wsStatus, lastTelemetryTimestamp } = useAppStore();

  const { data: healthData } = useQuery({
    queryKey: ['dataHealth', selectedWellId],
    queryFn: () => getDataHealth(selectedWellId),
    enabled: isOpen,
  });

  if (!isOpen) return null;

  const dataAgeSec = lastTelemetryTimestamp
    ? Math.max(0, Math.floor((Date.now() - lastTelemetryTimestamp) / 1000))
    : 0;

  const tagStatuses = lastTelemetry?.quality?.tagStatus || {};
  const tagsList = Object.entries(tagStatuses);
  const okTags = tagsList.filter(([_, status]) => status === 'ok').length;
  const staleTags = tagsList.filter(([_, status]) => status === 'stale').length;
  const badTags = tagsList.filter(([_, status]) => status === 'bad' || status === 'missing').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs select-none">
      <div className="relative w-full max-w-2xl bg-white border border-[#CBD5E1] rounded-md shadow-xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#F8FAFC] border-b border-[#E2E8F0]">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-800">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xs font-mono font-bold text-slate-900 uppercase tracking-wider">
                SCADA Telemetry Quality & Provenance
              </h2>
              <span className="text-[10px] text-slate-500 font-mono">
                Target: {selectedWellId} • Telemetry Streaming Link
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 space-y-4 overflow-y-auto">
          {/* Top KPI Cards */}
          <div className="grid grid-cols-4 gap-2">
            <div className="p-2.5 rounded bg-[#F8FAFC] border border-[#E2E8F0]">
              <span className="text-[9px] font-mono text-slate-500 uppercase block font-semibold">QUALITY STATUS</span>
              <span className="text-lg font-mono font-bold text-emerald-700">
                {healthData ? healthData.overallQuality.toUpperCase() : 'GOOD'}
              </span>
            </div>
            <div className="p-2.5 rounded bg-[#F8FAFC] border border-[#E2E8F0]">
              <span className="text-[9px] font-mono text-slate-500 uppercase block font-semibold">DATA MODE</span>
              <span className="text-xs font-mono font-bold text-amber-700 flex items-center gap-1 mt-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                SIMULATED
              </span>
            </div>
            <div className="p-2.5 rounded bg-[#F8FAFC] border border-[#E2E8F0]">
              <span className="text-[9px] font-mono text-slate-500 uppercase block font-semibold">STREAM STATUS</span>
              <span className="text-xs font-mono font-bold text-slate-800 flex items-center gap-1 mt-1">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    wsStatus === 'connected' ? 'bg-emerald-500' : 'bg-amber-500'
                  }`}
                />
                {wsStatus.toUpperCase()} ({dataAgeSec}s)
              </span>
            </div>
            <div className="p-2.5 rounded bg-[#F8FAFC] border border-[#E2E8F0]">
              <span className="text-[9px] font-mono text-slate-500 uppercase block font-semibold">TAG HEALTH</span>
              <span className="text-xs font-mono font-bold text-slate-800 mt-1 block">
                {okTags} OK • {staleTags} STALE • {badTags} BAD
              </span>
            </div>
          </div>

          {/* Mode Distinction Callout */}
          <div className="p-3 bg-amber-50/70 border border-amber-200 rounded text-xs font-mono text-amber-900 leading-relaxed">
            <div className="font-bold flex items-center gap-1.5 text-amber-950 mb-1">
              <Database className="w-3.5 h-3.5 text-amber-700" />
              OPERATING MODE: SIMULATED PHYSICS DIGITAL TWIN
            </div>
            All downhole and surface readings are generated via coupled first-principles models (Boberg-Lundberg CSS reservoir heat transfer & 1D damped wave rod string dynamics). Sensor values respect Baghewala heavy oil physical boundaries.
          </div>

          {/* SCADA Tag Breakdown Table */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-mono font-bold text-slate-800 uppercase tracking-wider">
                Monitored SCADA Instrumentation Tags
              </span>
              <span className="text-[10px] font-mono text-slate-500">
                {tagsList.length} Active Sensors
              </span>
            </div>

            <div className="border border-[#E2E8F0] rounded overflow-hidden max-h-52 overflow-y-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Sensor Tag ID</th>
                    <th>Subsystem</th>
                    <th>Status</th>
                    <th>Current Value</th>
                  </tr>
                </thead>
                <tbody>
                  {tagsList.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-center py-4 text-slate-400">
                        Acquiring telemetry tags...
                      </td>
                    </tr>
                  ) : (
                    tagsList.map(([tagKey, status]) => {
                      let tagVal = '—';
                      if (lastTelemetry) {
                        if (tagKey.includes('pressure') || tagKey === 'bhp') {
                          tagVal = `${lastTelemetry.wellbore.bhp.toFixed(1)} bar`;
                        } else if (tagKey.includes('temp') || tagKey === 'bht') {
                          tagVal = `${lastTelemetry.wellbore.bht.toFixed(1)} °C`;
                        } else if (tagKey.includes('flow') || tagKey === 'oilRate') {
                          tagVal = `${lastTelemetry.surface.oilRate.toFixed(1)} m³/d`;
                        } else if (tagKey.includes('spm')) {
                          tagVal = `${lastTelemetry.srp.spm.toFixed(1)} SPM`;
                        } else if (tagKey.includes('load')) {
                          tagVal = `${lastTelemetry.srp.rodLoadMax.toFixed(1)} kN`;
                        }
                      }
                      return (
                        <tr key={tagKey}>
                          <td className="font-semibold text-slate-900">{tagKey}</td>
                          <td className="text-slate-600">
                            {tagKey.startsWith('res')
                              ? 'Reservoir'
                              : tagKey.startsWith('wb') || tagKey === 'bhp' || tagKey === 'bht'
                              ? 'Wellbore'
                              : tagKey.startsWith('srp')
                              ? 'Surface SRP'
                              : 'Surface Line'}
                          </td>
                          <td>
                            <span
                              className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                                status === 'ok'
                                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                  : status === 'stale'
                                  ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                  : 'bg-rose-50 text-rose-800 border border-rose-200'
                              }`}
                            >
                              {status}
                            </span>
                          </td>
                          <td className="font-bold text-slate-800">{tagVal}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-[#F8FAFC] border-t border-[#E2E8F0]">
          <span className="text-[10px] font-mono text-slate-500">
            ISO 15926 / OPC-UA Conformance Level: High
          </span>
          <button onClick={onClose} className="btn-secondary text-xs">
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
};
