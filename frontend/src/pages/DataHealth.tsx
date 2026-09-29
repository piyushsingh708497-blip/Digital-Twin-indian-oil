// OIL-TWIN AI - Sensor & Data Health Diagnostics Page
// Monitors tag staleness, dropout, missing sensors, and telemetry latency
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Radio,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { getDataHealth } from '../services/api';
import { useAppStore } from '../store/useAppStore';
import { StatusBadge } from '../components/ui/StatusBadge';
import { KpiCard } from '../components/ui/KpiCard';
import { ErrorState, LoadingSkeleton } from '../components/ui/FeedbackStates';

export const DataHealth: React.FC = () => {
  const { selectedWellId } = useAppStore();

  const {
    data: health,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['dataHealth', selectedWellId],
    queryFn: () => getDataHealth(selectedWellId),
    refetchInterval: 10000,
  });

  if (isError) {
    return (
      <ErrorState
        title="Diagnostics Unavailable"
        message={`Could not retrieve sensor data health for well ${selectedWellId}.`}
        onRetry={refetch}
      />
    );
  }

  const tags = health?.tagStatus || {};
  const tagList = Object.entries(tags);

  const okTags = tagList.filter(([_, status]) => status === 'ok');
  const staleTags = tagList.filter(([_, status]) => status === 'stale');
  const badTags = tagList.filter(([_, status]) => status === 'bad');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-4 rounded-xl bg-white border border-[#E2E5E9] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono font-bold text-amber-700 uppercase tracking-widest">
              INSTRUMENTATION & TELEMETRY INTEGRITY
            </span>
            <span className="text-[10px] font-mono bg-[#F1F3F5] text-slate-700 px-2 py-0.5 rounded-md border border-[#E2E5E9] font-medium">
              Sensor Diagnostics
            </span>
          </div>
          <h1 className="text-lg font-bold text-slate-900 tracking-wide flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            Sensor Data Quality & Health — {selectedWellId}
          </h1>
          <p className="text-xs text-slate-500 font-mono mt-0.5">
            Continuous verification of downhole pressure, temperature, rod load cells, and surface flow transmitters
          </p>
        </div>

        <div className="flex items-center gap-3">
          {health?.overallQuality && (
            <StatusBadge type="quality" value={health.overallQuality} label={`Overall: ${health.overallQuality}`} />
          )}
          <button onClick={() => refetch()} className="btn-secondary text-xs">
            <RefreshCw className="w-3.5 h-3.5 text-slate-600" />
            Run Diagnostic Scan
          </button>
        </div>
      </div>

      {isLoading ? (
        <LoadingSkeleton rows={3} height="h-28" />
      ) : health ? (
        <>
          {/* Health Summary KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KpiCard
              label="Telemetry Latency"
              value={health.dataAgeSec !== null ? `${health.dataAgeSec.toFixed(1)}` : 'N/A'}
              unit="sec"
              icon={Clock}
              highlight={health.dataAgeSec > 5 ? 'warning' : 'healthy'}
              subtext="Field Telemetry Age"
            />
            <KpiCard
              label="Healthy Sensor Tags"
              value={`${okTags.length} / ${tagList.length}`}
              icon={CheckCircle2}
              highlight="healthy"
              subtext="Reporting Valid Data"
            />
            <KpiCard
              label="Stale or Degraded"
              value={staleTags.length + badTags.length}
              icon={AlertTriangle}
              highlight={staleTags.length + badTags.length > 0 ? 'warning' : 'healthy'}
              subtext="Unrefreshed Telemetry"
            />
            <KpiCard
              label="Missing Sensors"
              value={health.missingSensors ? health.missingSensors.length : 0}
              icon={Radio}
              highlight={health.missingSensors && health.missingSensors.length > 0 ? 'critical' : 'healthy'}
              subtext="Offline Transmitters"
            />
          </div>

          {/* Warnings Banner if any */}
          {health.warnings && health.warnings.length > 0 && (
            <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-xl space-y-2 shadow-xs">
              <span className="text-xs font-bold text-amber-800 flex items-center gap-1.5 font-mono">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                ACTIVE DATA HEALTH WARNINGS ({health.warnings.length})
              </span>
              <ul className="text-xs text-amber-900 font-mono space-y-1 list-disc list-inside">
                {health.warnings.map((w, idx) => (
                  <li key={idx}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Detailed Tag Quality Grid */}
          <div className="bg-white border border-[#E2E5E9] rounded-xl p-5 space-y-4 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-[#E2E5E9]">
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider font-mono">
                Wellhead & Downhole Sensor Tag Matrix
              </span>
              <span className="text-xs text-slate-500 font-mono">
                {tagList.length} monitored tags
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {tagList.map(([tag, status]) => (
                <div
                  key={tag}
                  className="p-3 bg-[#F8F9FA] border border-[#E2E5E9] rounded-lg flex items-center justify-between hover:bg-white hover:border-slate-300 transition-colors shadow-2xs"
                >
                  <div className="min-w-0 pr-2">
                    <span className="font-mono text-xs font-semibold text-slate-900 truncate block">
                      {tag}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {status === 'ok' ? 'Nominal Range' : status.toUpperCase()}
                    </span>
                  </div>
                  <StatusBadge type="tag" value={status} />
                </div>
              ))}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
};

export default DataHealth;
