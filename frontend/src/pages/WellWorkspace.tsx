// OIL-TWIN AI - Well Workspace Flagship Operational Page
// Real-time telemetry, live dynamometer card, historical time-series replay, and equipment telemetry
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Cpu,
  Flame,
  Sliders,
} from 'lucide-react';
import { getDataHealth, getWellHistory, getWellState, getWells } from '../services/api';
import { useAppStore } from '../store/useAppStore';
import { StatusBadge } from '../components/ui/StatusBadge';
import { KpiCard } from '../components/ui/KpiCard';
import { DynoCardChart } from '../components/charts/DynoCardChart';
import type { MetricKey } from '../components/charts/TimeSeriesChart';
import { TimeSeriesChart } from '../components/charts/TimeSeriesChart';
import { ErrorState, LoadingSkeleton } from '../components/ui/FeedbackStates';
import { FailureEarlyWarningCard } from '../components/early-warning/FailureEarlyWarningCard';

export const WellWorkspace: React.FC = () => {
  const { wellId = 'BW-01' } = useParams<{ wellId: string }>();
  const navigate = useNavigate();
  const {
    setSelectedWellId,
    lastTelemetry,
    wsStatus,
  } = useAppStore();

  const [selectedRange, setSelectedRange] = useState('24h');
  const [activeMetric, setActiveMetric] = useState<MetricKey>('oilRate');

  // Keep global store in sync with route parameter
  useEffect(() => {
    if (wellId) {
      setSelectedWellId(wellId);
    }
  }, [wellId, setSelectedWellId]);

  // 1. Fetch Well State (Static initial snapshot, active alerts, dyno card)
  const {
    data: wellState,
    isLoading: isStateLoading,
    isError: isStateError,
    refetch: refetchState,
  } = useQuery({
    queryKey: ['wellState', wellId],
    queryFn: () => getWellState(wellId),
    refetchInterval: 10000,
  });

  // 2. Fetch Well History for Time-Series Scrubber
  const {
    data: history,
    isLoading: isHistoryLoading,
  } = useQuery({
    queryKey: ['wellHistory', wellId, selectedRange],
    queryFn: () => getWellHistory(wellId),
    staleTime: 30000,
  });

  // 3. Fetch Data Health Diagnostics
  const { data: dataHealth } = useQuery({
    queryKey: ['dataHealth', wellId],
    queryFn: () => getDataHealth(wellId),
    refetchInterval: 15000,
  });

  // 4. Fetch Wells list for header information
  const { data: wells } = useQuery({
    queryKey: ['wells'],
    queryFn: getWells,
  });

  const currentWell = wells?.find((w) => w.id === wellId);

  // Live telemetry preference: if WebSocket pushed a recent frame, use it; otherwise fallback to state snapshot
  const currentTel = lastTelemetry || wellState?.telemetry;

  if (isStateError) {
    return (
      <ErrorState
        title={`Well ${wellId} Offline`}
        message={`Could not load operational state for well '${wellId}'. Verify that the well exists in the field simulation.`}
        onRetry={refetchState}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* ════ 1. WELL WORKSPACE HEADER ════ */}
      <div className="p-4 rounded-xl bg-white border border-[#E2E5E9] flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/wells')}
            className="p-2 rounded-lg bg-slate-50 hover:bg-slate-100 border border-[#E2E5E9] text-slate-600 hover:text-slate-900 transition-colors shadow-xs"
            title="Back to Wells Inventory"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl font-mono font-bold text-slate-900 tracking-tight">
                {wellId}
              </span>
              <span className="text-xs text-slate-500 font-sans">
                {currentWell?.name || 'Heavy Oil Producer'}
              </span>
              {currentWell?.cssCyclePhase && (
                <StatusBadge type="phase" value={currentWell.cssCyclePhase} />
              )}
              {dataHealth?.overallQuality && (
                <StatusBadge type="quality" value={dataHealth.overallQuality} label={`Data: ${dataHealth.overallQuality}`} />
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-slate-500">
              <span>Formation: Jodhpur Sandstone</span>
              <span>•</span>
              <span>Cycle #{currentWell?.cycleNumber ?? 5}</span>
              <span>•</span>
              <span className="text-emerald-700 font-semibold">Status: {currentWell?.status ?? 'Active'}</span>
            </div>
          </div>
        </div>

        {/* Live Streaming Badge and Action Quick Links */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 font-mono text-xs">
            <span
              className={`w-2 h-2 rounded-full ${
                wsStatus === 'connected'
                  ? 'bg-emerald-500 animate-pulse'
                  : wsStatus === 'stale'
                  ? 'bg-amber-500'
                  : 'bg-rose-500'
              }`}
            />
            <span className="text-slate-700 uppercase tracking-wider font-semibold">
              WS STREAM: {wsStatus}
            </span>
          </div>

          <button
            onClick={() => navigate('/digital-twin')}
            className="btn-secondary text-xs flex items-center gap-1.5"
          >
            <Cpu className="w-3.5 h-3.5 text-blue-600" />
            Digital Twin
          </button>

          <button
            onClick={() => navigate('/css')}
            className="btn-secondary text-xs flex items-center gap-1.5"
          >
            <Flame className="w-3.5 h-3.5 text-amber-600" />
            CSS Optimization
          </button>

          <button
            onClick={() => navigate('/srp')}
            className="btn-secondary text-xs flex items-center gap-1.5"
          >
            <Sliders className="w-3.5 h-3.5 text-emerald-600" />
            SRP Analysis
          </button>
        </div>
      </div>

      {/* ════ FAILURE EARLY WARNING SYSTEM ════ */}
      <FailureEarlyWarningCard wellId={wellId} />

      {/* ════ 2. REAL-TIME TELEMETRY CARDS (CATEGORIZED) ════ */}
      {isStateLoading && !currentTel ? (
        <LoadingSkeleton rows={2} height="h-32" />
      ) : (
        <div className="space-y-4">
          {/* Top Operational KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <KpiCard
              label="Oil Production Rate"
              value={currentTel?.surface?.oilRate ? currentTel.surface.oilRate.toFixed(1) : '—'}
              unit="m³/d"
              highlight="healthy"
              subtext="Surface Rate"
            />
            <KpiCard
              label="Water Cut"
              value={currentTel?.surface?.waterCutPct ? currentTel.surface.waterCutPct.toFixed(1) : '—'}
              unit="%"
              highlight={currentTel && currentTel.surface?.waterCutPct > 90 ? 'warning' : 'default'}
              subtext="Water Fraction"
            />
            <KpiCard
              label="Bottomhole Temp"
              value={currentTel?.wellbore?.bht ? currentTel.wellbore.bht.toFixed(1) : '—'}
              unit="°C"
              highlight="accent"
              subtext="Wellbore BHT"
            />
            <KpiCard
              label="Bottomhole Pressure"
              value={currentTel?.wellbore?.bhp ? currentTel.wellbore.bhp.toFixed(1) : '—'}
              unit="bar"
              highlight="default"
              subtext="Wellbore BHP"
            />
            <KpiCard
              label="Steam-Oil Ratio"
              value={currentTel?.derived?.sor ? currentTel.derived.sor.toFixed(2) : '—'}
              unit="t/m³"
              highlight={currentTel?.derived?.sor && currentTel.derived.sor > 4.5 ? 'warning' : 'default'}
              subtext="Current SOR"
            />
            <KpiCard
              label="Specific Energy"
              value={currentTel?.derived?.kWhPerBbl ? currentTel.derived.kWhPerBbl.toFixed(1) : '—'}
              unit="kWh/bbl"
              highlight="default"
              subtext="Energy / bbl"
            />
          </div>

          {/* Detailed Subsystem Telemetry Grids */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Reservoir Subsystem */}
            <div className="bg-white border border-[#E2E5E9] rounded-xl p-3.5 space-y-2.5 shadow-xs">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="text-xs font-bold text-amber-700 uppercase tracking-wider font-mono">
                  1. Reservoir Subsystem
                </span>
                <span className="text-[10px] font-mono text-slate-500">Jodhpur Sand</span>
              </div>
              <div className="space-y-1.5 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-500">Pressure:</span>
                  <span className="text-slate-900 font-bold">{currentTel?.reservoir?.pressure?.toFixed(1) ?? '—'} bar</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Temperature:</span>
                  <span className="text-slate-900 font-bold">{currentTel?.reservoir?.temperature?.toFixed(1) ?? '—'} °C</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Oil Viscosity:</span>
                  <span className="text-amber-800 font-bold">
                    {currentTel?.reservoir?.temperature
                      ? Math.round(5000 / Math.max(1, currentTel.reservoir.temperature / 48))
                      : '—'}{' '}
                    cP
                  </span>
                </div>
              </div>
            </div>

            {/* Wellbore Subsystem */}
            <div className="bg-white border border-[#E2E5E9] rounded-xl p-3.5 space-y-2.5 shadow-xs">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="text-xs font-bold text-blue-700 uppercase tracking-wider font-mono">
                  2. Wellbore Subsystem
                </span>
                <span className="text-[10px] font-mono text-slate-500">Annulus</span>
              </div>
              <div className="space-y-1.5 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-500">Bottomhole Press (BHP):</span>
                  <span className="text-slate-900 font-bold">{currentTel?.wellbore?.bhp?.toFixed(1) ?? '—'} bar</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Bottomhole Temp (BHT):</span>
                  <span className="text-slate-900 font-bold">{currentTel?.wellbore?.bht?.toFixed(1) ?? '—'} °C</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Fluid Level:</span>
                  <span className="text-blue-700 font-bold">{currentTel?.wellbore?.fluidLevel?.toFixed(1) ?? '—'} m</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Steam Quality:</span>
                  <span className="text-slate-900 font-bold">
                    {currentTel?.wellbore?.steamQuality
                      ? `${(currentTel.wellbore.steamQuality * 100).toFixed(0)}%`
                      : '—'}
                  </span>
                </div>
              </div>
            </div>

            {/* CSS Subsystem */}
            <div className="bg-white border border-[#E2E5E9] rounded-xl p-3.5 space-y-2.5 shadow-xs">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="text-xs font-bold text-amber-700 uppercase tracking-wider font-mono">
                  3. CSS Subsystem
                </span>
                <span className="text-[10px] font-mono text-slate-500">Steam Cycle</span>
              </div>
              <div className="space-y-1.5 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-500">Steam Rate:</span>
                  <span className="text-slate-900 font-bold">{currentTel?.css?.steamRate?.toFixed(1) ?? '0.0'} t/d</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Injection Pressure:</span>
                  <span className="text-slate-900 font-bold">{currentTel?.css?.injPressure?.toFixed(1) ?? '—'} bar</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Cumulative Steam:</span>
                  <span className="text-amber-800 font-bold">{currentTel?.css?.cumSteam?.toFixed(0) ?? '—'} tonnes</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Soak Period:</span>
                  <span className="text-slate-900 font-bold">{currentTel?.css?.soakDay?.toFixed(1) ?? '—'} days</span>
                </div>
              </div>
            </div>

            {/* SRP Subsystem */}
            <div className="bg-white border border-[#E2E5E9] rounded-xl p-3.5 space-y-2.5 shadow-xs">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider font-mono">
                  4. SRP Mechanics & Power
                </span>
                <span className="text-[10px] font-mono text-slate-500">Surface Pumping</span>
              </div>
              <div className="space-y-1.5 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-500">Pumping Speed (SPM):</span>
                  <span className="text-slate-900 font-bold">{currentTel?.srp?.spm?.toFixed(1) ?? '—'} spm</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Stroke Length:</span>
                  <span className="text-slate-900 font-bold">{currentTel?.srp?.strokeLength?.toFixed(2) ?? '—'} m</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">VFD Frequency:</span>
                  <span className="text-slate-900 font-bold">{currentTel?.srp?.vfdHz?.toFixed(1) ?? '—'} Hz</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Motor Power / Current:</span>
                  <span className="text-emerald-700 font-bold">
                    {currentTel?.srp?.kW?.toFixed(1) ?? '—'} kW ({currentTel?.srp?.motorAmps?.toFixed(1) ?? '—'} A)
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Pump Fillage:</span>
                  <span className="text-slate-900 font-bold">{currentTel?.srp?.pumpFillagePct?.toFixed(0) ?? '—'}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Peak / Min Rod Load:</span>
                  <span className="text-amber-800 font-bold">
                    {currentTel?.srp?.rodLoadMax?.toFixed(1) ?? '—'} / {currentTel?.srp?.rodLoadMin?.toFixed(1) ?? '—'} kN
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════ 3. DYNAMOMETER CARD & HISTORICAL TIME SERIES SCRUBBER ════ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Live SRP Dyno Card Analysis */}
        <div className="lg:col-span-1">
          <DynoCardChart
            dynoCard={wellState?.dynoCard}
            height="360px"
            title={`SRP Dynamometer Card — ${wellId}`}
          />
        </div>

        {/* Right Column: Historical Replay / Time Series Scrubber */}
        <div className="lg:col-span-2">
          {isHistoryLoading ? (
            <LoadingSkeleton rows={1} height="h-[380px]" />
          ) : (
            <TimeSeriesChart
              history={history}
              activeMetric={activeMetric}
              onMetricChange={setActiveMetric}
              selectedRange={selectedRange}
              onRangeChange={setSelectedRange}
              height="300px"
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default WellWorkspace;
