// OIL-TWIN AI - Command Center Top Navigation Bar (Industrial Redesign)
import React, { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Bell,
  Database,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { getAlerts, getWells, getDataHealth } from '../../services/api';
import { useAppStore } from '../../store/useAppStore';
import { DataQualityModal } from './DataQualityModal';

export const TopBar: React.FC = () => {
  const navigate = useNavigate();
  const {
    selectedWellId,
    setSelectedWellId,
    wsStatus,
    lastTelemetry,
    lastTelemetryTimestamp,
    setUnacknowledgedAlertCount,
  } = useAppStore();

  const [dataAgeSec, setDataAgeSec] = useState<number>(0);
  const [dataQualityOpen, setDataQualityOpen] = useState(false);

  // Fetch well list for global dropdown
  const { data: wells } = useQuery({
    queryKey: ['wells'],
    queryFn: getWells,
    staleTime: 60000,
  });

  // Fetch alerts count for notification bell
  const { data: alerts } = useQuery({
    queryKey: ['alerts'],
    queryFn: () => getAlerts(),
    refetchInterval: 10000,
  });

  // Fetch data quality score
  const { data: dataHealth } = useQuery({
    queryKey: ['dataHealth', selectedWellId],
    queryFn: () => getDataHealth(selectedWellId),
    refetchInterval: 30000,
  });

  const unackCount = alerts ? alerts.filter((a) => !a.acknowledged).length : 0;

  useEffect(() => {
    setUnacknowledgedAlertCount(unackCount);
  }, [unackCount, setUnacknowledgedAlertCount]);

  // Update data age ticker every second
  useEffect(() => {
    const timer = setInterval(() => {
      if (lastTelemetryTimestamp) {
        const diff = Math.floor((Date.now() - lastTelemetryTimestamp) / 1000);
        setDataAgeSec(diff);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [lastTelemetryTimestamp]);

  const currentWell = wells?.find((w) => w.id === selectedWellId);

  return (
    <>
      <header className="h-13 px-4 sm:px-5 bg-white border-b border-[#E2E8F0] flex items-center justify-between z-20 select-none shadow-xs">
        {/* Left: Brand, Field, & Data Provenance Mode */}
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-sm text-slate-900 tracking-wider">
              OIL-TWIN AI
            </span>
            <span className="text-slate-300">/</span>
            <span className="text-xs font-semibold text-slate-700 font-sans tracking-tight">
              Baghewala Field
            </span>
            <span className="text-[10px] text-slate-400 font-mono hidden xl:inline-block">
              (17-19° API • Jodhpur Sandstone)
            </span>
          </div>

          {/* Persistent SIMULATION MODE Badge */}
          <div className="flex items-center gap-1.5 px-2 py-0.5 bg-[#F8FAFC] border border-[#CBD5E1] rounded text-slate-800 text-[10px] font-mono font-bold tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />
            <Database className="w-3 h-3 text-slate-600" />
            <span>SIMULATION MODE</span>
          </div>

          {/* Compact Data Quality Indicator (Clickable to open inspector) */}
          <button
            onClick={() => setDataQualityOpen(true)}
            className="hidden md:flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono border border-emerald-200 bg-emerald-50/70 hover:bg-emerald-100/70 text-emerald-900 transition-colors cursor-pointer"
            title="Inspect SCADA Tag Health & Sensor Diagnostics"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
            <span className="font-bold">
              {dataHealth ? `QUALITY: ${dataHealth.overallQuality.toUpperCase()}` : '98.4% QUALITY'}
            </span>
            <span className="text-emerald-700/70">● HEALTHY</span>
          </button>

          {/* Live Stream Status Indicator */}
          <div className="hidden lg:flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono border bg-slate-50 border-slate-200 text-slate-700">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                wsStatus === 'connected'
                  ? 'bg-emerald-600'
                  : wsStatus === 'stale'
                  ? 'bg-amber-600'
                  : 'bg-rose-600'
              }`}
            />
            <span className="font-semibold uppercase tracking-wider">
              {wsStatus === 'connected' ? 'LIVE' : wsStatus}
            </span>
            {wsStatus === 'connected' && (
              <span className="text-slate-400 text-[9px] tabular-nums">
                ({dataAgeSec > 0 ? `${dataAgeSec}s` : '<1s'})
              </span>
            )}
          </div>
        </div>

        {/* Right: Well Selector, Telemetry Stamp, Alerts, User Profile */}
        <div className="flex items-center gap-2.5">
          {/* Global Well Selector Dropdown */}
          <div className="relative flex items-center">
            <div className="flex items-center gap-1.5 bg-[#F8FAFC] hover:bg-slate-100 border border-[#CBD5E1] rounded px-2.5 py-1 text-xs text-slate-800 transition-colors">
              <span className="text-slate-500 text-[10px] font-mono font-semibold">TARGET:</span>
              <select
                value={selectedWellId}
                onChange={(e) => setSelectedWellId(e.target.value)}
                className="bg-transparent font-mono font-bold text-slate-900 focus:outline-none cursor-pointer text-xs pr-1"
              >
                {wells ? (
                  wells.map((w) => (
                    <option key={w.id} value={w.id} className="bg-white text-slate-900 font-mono">
                      {w.id} ({w.name}) — {w.cssCyclePhase.toUpperCase()}
                    </option>
                  ))
                ) : (
                  <option value={selectedWellId} className="bg-white text-slate-900 font-mono">
                    {selectedWellId}
                  </option>
                )}
              </select>
              {currentWell && (
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-white text-slate-700 border border-slate-200 font-mono font-semibold hidden xl:inline-block">
                  C#{currentWell.cycleNumber}
                </span>
              )}
              <button
                onClick={() => navigate(`/wells/${selectedWellId}`)}
                className="p-0.5 text-slate-400 hover:text-slate-800 transition-colors"
                title="Open Well Workspace"
              >
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Last Telemetry Timestamp */}
          {lastTelemetry?.ts && (
            <div className="hidden xl:flex flex-col text-right font-mono text-[9px] text-slate-500 leading-tight">
              <span className="text-slate-400">FRAME TS</span>
              <span className="text-slate-700 font-semibold tabular-nums">
                {lastTelemetry.ts.includes('T') ? lastTelemetry.ts.split('T')[1].slice(0, 8) : lastTelemetry.ts}
              </span>
            </div>
          )}

          {/* Notifications Icon with Badge */}
          <NavLink
            to="/alerts"
            className="relative p-1.5 rounded bg-white hover:bg-slate-50 border border-[#CBD5E1] text-slate-600 hover:text-slate-900 transition-colors"
            title="View Active Operational Alerts"
          >
            <Bell className="w-3.5 h-3.5" />
            {unackCount > 0 && (
              <span className="absolute -top-1 -right-1 px-1 py-0.2 min-w-3.5 text-[9px] font-mono font-bold bg-rose-600 text-white rounded-full flex items-center justify-center">
                {unackCount}
              </span>
            )}
          </NavLink>

          {/* Engineer Profile Badge */}
          <div className="flex items-center gap-2 pl-2 border-l border-[#E2E8F0]">
            <div className="w-6 h-6 rounded bg-slate-100 border border-slate-300 flex items-center justify-center text-slate-700 font-mono font-bold text-[9px]">
              OIL
            </div>
            <div className="hidden lg:flex flex-col text-left leading-none">
              <span className="text-[10px] font-semibold text-slate-800">Field Engineer</span>
              <span className="text-[8px] text-slate-400 font-mono mt-0.5">Control Room #1</span>
            </div>
          </div>
        </div>
      </header>

      {/* Data Quality Modal */}
      <DataQualityModal isOpen={dataQualityOpen} onClose={() => setDataQualityOpen(false)} />
    </>
  );
};
