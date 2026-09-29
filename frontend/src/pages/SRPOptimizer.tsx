// OIL-TWIN AI - Sucker Rod Pump (SRP) Analysis & Dynamometer Diagnostic Page
// Evaluates Stroke Length, SPM, VFD Frequency; returns mechanical integrity, rod stress, and dyno card
import React, { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Activity,
  AlertTriangle,
  Droplets,
  Play,
  RotateCcw,
  Sliders,
  Zap,
} from 'lucide-react';
import { analyzeSrp, getWellState } from '../services/api';
import { useAppStore } from '../store/useAppStore';
import { DynoCardChart } from '../components/charts/DynoCardChart';
import { KpiCard } from '../components/ui/KpiCard';
import { LoadingSkeleton } from '../components/ui/FeedbackStates';
import type { SrpAnalysis, SrpSetpoints } from '../types';

export const SRPOptimizer: React.FC = () => {
  const { selectedWellId } = useAppStore();

  const [setpoints, setSetpoints] = useState<SrpSetpoints>({
    strokeLength: 2.8,
    spm: 4.5,
    vfdHz: 45.0,
  });

  const [analysisResult, setAnalysisResult] = useState<SrpAnalysis | null>(null);

  // Fetch well state
  const { data: wellState } = useQuery({
    queryKey: ['wellState', selectedWellId],
    queryFn: () => getWellState(selectedWellId),
  });

  // Mutation for SRP analysis
  const srpMutation = useMutation({
    mutationFn: (sp: SrpSetpoints) => analyzeSrp(selectedWellId, sp),
    onSuccess: (data) => {
      setAnalysisResult(data);
    },
  });

  // Run on initial load
  React.useEffect(() => {
    if (!analysisResult && !srpMutation.isPending) {
      srpMutation.mutate(setpoints);
    }
  }, [selectedWellId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    srpMutation.mutate(setpoints);
  };

  const handleReset = () => {
    const defaultSp: SrpSetpoints = {
      strokeLength: 2.8,
      spm: 4.5,
      vfdHz: 45.0,
    };
    setSetpoints(defaultSp);
    srpMutation.mutate(defaultSp);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="p-4 rounded-xl bg-white border border-[#E2E5E9] flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono font-bold text-amber-700 uppercase tracking-widest">
              PUMPING MECHANICS & DIAGNOSTICS
            </span>
            <span className="text-[10px] font-mono bg-emerald-50 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded font-bold">
              Gibbs Damped 1D Wave
            </span>
          </div>
          <h1 className="text-lg font-bold text-slate-900 tracking-wide flex items-center gap-2">
            <Activity className="w-5 h-5 text-emerald-600" />
            SRP Mechanics & Dyno Card Diagnostic Engine — {selectedWellId}
          </h1>
          <p className="text-xs text-slate-500 font-mono mt-0.5">
            Evaluate stroke length, pumping speed, and VFD frequency against rod floating and mechanical stresses
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-xs font-mono bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700">
            Working Fluid Level: <span className="text-blue-700 font-bold">{wellState?.telemetry?.wellbore?.fluidLevel?.toFixed(1) ?? '420.0'} m</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Controls + Outputs */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Setpoints Inputs */}
        <div className="lg:col-span-4 bg-white border border-[#E2E5E9] rounded-xl p-4 space-y-3.5 shadow-xs">
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5 font-mono">
              <Sliders className="w-3.5 h-3.5 text-emerald-600" />
              Pumping Setpoints
            </span>
            <button
              type="button"
              onClick={handleReset}
              className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 font-mono transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              Reset
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
            {/* Stroke Length */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="input-label !mb-0 text-slate-700 font-medium">Stroke Length (m)</label>
                <span className="font-mono text-amber-800 font-bold">
                  {setpoints.strokeLength.toFixed(2)} m
                </span>
              </div>
              <input
                type="range"
                min="1.0"
                max="4.5"
                step="0.1"
                value={setpoints.strokeLength}
                onChange={(e) =>
                  setSetpoints({ ...setpoints, strokeLength: Number(e.target.value) })
                }
                className="w-full accent-amber-600 cursor-pointer h-1.5 bg-slate-200 rounded"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-0.5">
                <span>1.0 m</span>
                <span>2.8 m (Base)</span>
                <span>4.5 m</span>
              </div>
            </div>

            {/* SPM */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="input-label !mb-0 text-slate-700 font-medium">Strokes Per Minute (SPM)</label>
                <span className="font-mono text-emerald-700 font-bold">
                  {setpoints.spm.toFixed(1)} spm
                </span>
              </div>
              <input
                type="range"
                min="1.0"
                max="12.0"
                step="0.5"
                value={setpoints.spm}
                onChange={(e) =>
                  setSetpoints({ ...setpoints, spm: Number(e.target.value) })
                }
                className="w-full accent-emerald-600 cursor-pointer h-1.5 bg-slate-200 rounded"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-0.5">
                <span>1.0 spm</span>
                <span>4.5 spm</span>
                <span>12.0 spm</span>
              </div>
            </div>

            {/* VFD Frequency */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="input-label !mb-0 text-slate-700 font-medium">VFD Drive Frequency (Hz)</label>
                <span className="font-mono text-blue-700 font-bold">
                  {setpoints.vfdHz.toFixed(1)} Hz
                </span>
              </div>
              <input
                type="range"
                min="20.0"
                max="65.0"
                step="1.0"
                value={setpoints.vfdHz}
                onChange={(e) =>
                  setSetpoints({ ...setpoints, vfdHz: Number(e.target.value) })
                }
                className="w-full accent-blue-600 cursor-pointer h-1.5 bg-slate-200 rounded"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-0.5">
                <span>20 Hz</span>
                <span>45 Hz</span>
                <span>65 Hz</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={srpMutation.isPending}
              className="w-full btn-primary text-xs justify-center py-2.5 mt-2"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              {srpMutation.isPending ? 'Computing Wave Mechanics...' : 'Analyze SRP Mechanics'}
            </button>
          </form>

          {/* Warnings List */}
          {analysisResult?.warnings && analysisResult.warnings.length > 0 && (
            <div className="p-3 bg-rose-50 rounded-lg border border-rose-200 space-y-1">
              <span className="text-xs font-bold text-rose-800 flex items-center gap-1 font-mono">
                <AlertTriangle className="w-3.5 h-3.5" />
                MECHANICAL WARNINGS
              </span>
              <ul className="text-[11px] text-rose-800/90 space-y-1 list-disc list-inside">
                {analysisResult.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Right Column: KPIs + Dyno Card */}
        <div className="lg:col-span-8 space-y-4">
          {srpMutation.isPending ? (
            <LoadingSkeleton rows={2} height="h-36" />
          ) : analysisResult ? (
            <>
              {/* Output KPIs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <KpiCard
                  label="Predicted Oil Rate"
                  value={analysisResult.predictedOilRate?.toFixed(1) ?? '—'}
                  unit="m³/d"
                  icon={Droplets}
                  highlight="healthy"
                  subtext="Surface Delivery"
                />
                <KpiCard
                  label="Rod Stress"
                  value={analysisResult.rodStressPct?.toFixed(1) ?? '—'}
                  unit="%"
                  icon={Activity}
                  highlight={analysisResult.rodStressPct > 80 ? 'critical' : 'default'}
                  subtext="Max Allowable Stress"
                />
                <KpiCard
                  label="Motor Power"
                  value={analysisResult.kW?.toFixed(1) ?? '—'}
                  unit="kW"
                  icon={Zap}
                  highlight="default"
                  subtext="Electrical Consumption"
                />
                <KpiCard
                  label="Failure Risk Score"
                  value={`${(analysisResult.failureRisk * 100).toFixed(1)}%`}
                  icon={AlertTriangle}
                  highlight={analysisResult.failureRisk > 0.4 ? 'critical' : 'healthy'}
                  subtext="AI Model Assessment"
                />
              </div>

              {/* Exact Dyno Card returned from backend */}
              <DynoCardChart
                dynoCard={analysisResult.dynoCard}
                height="380px"
                title={`Surface & Downhole Dynamometer Card — SPM ${setpoints.spm} • Stroke ${setpoints.strokeLength}m`}
              />
            </>
          ) : (
            <div className="p-12 text-center text-slate-500 bg-white rounded-xl border border-[#E2E5E9] shadow-xs">
              Run SRP analysis to compute downhole pump fillage, rod stress, and dyno card.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SRPOptimizer;
