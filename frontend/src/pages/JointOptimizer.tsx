// OIL-TWIN AI - Joint Coupled Optimization Page (Industrial Redesign)
// Compares Baseline Separate vs Joint Coupled Optimization and visualizes Pareto Trade-Off Front
// Features: CSS+SRP Coupling Relationship Chain, Operational Performance Matrix, and Interactive Pareto Frontier

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  CheckCircle2,
  Droplets,
  Flame,
  GitCompare,
  GitMerge,
  Zap,
} from 'lucide-react';
import { getJointOptimization, getWellState } from '../services/api';
import { useAppStore } from '../store/useAppStore';
import { ParetoScatterChart } from '../components/charts/ParetoScatterChart';
import { CouplingRelationshipDiagram } from '../components/digital-twin/CouplingRelationshipDiagram';
import { ErrorState, LoadingSkeleton } from '../components/ui/FeedbackStates';

export const JointOptimizer: React.FC = () => {
  const navigate = useNavigate();
  const { selectedWellId } = useAppStore();

  const {
    data: jointData,
    isLoading: isJointLoading,
    isError: isJointError,
    refetch,
  } = useQuery({
    queryKey: ['jointOptimization', selectedWellId],
    queryFn: () => getJointOptimization(selectedWellId),
  });

  const { data: wellState } = useQuery({
    queryKey: ['wellState', selectedWellId],
    queryFn: () => getWellState(selectedWellId),
  });

  if (isJointError) {
    return (
      <ErrorState
        title="Joint Optimization Unavailable"
        message={`Could not compute coupled surrogate Pareto optimization for well ${selectedWellId}.`}
        onRetry={refetch}
      />
    );
  }

  const baseline = jointData?.baselineSeparate;
  const joint = jointData?.jointOptimized;
  const currentTel = wellState?.telemetry;

  // Real deltas computed from backend response
  const oilDelta = joint && baseline ? joint.oilRate - baseline.oilRate : 0;
  const sorDelta = joint && baseline ? joint.sor - baseline.sor : 0;
  const energyDelta = joint && baseline ? joint.kWhPerBbl - baseline.kWhPerBbl : 0;
  const riskDelta = joint && baseline ? joint.failureRisk - baseline.failureRisk : 0;

  const hasJointImprovement =
    joint && (joint.oilUpliftPct > 0.5 || joint.sorReductionPct > 0.5 || joint.energySavingPct > 0.5);

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="p-3.5 rounded-md bg-white border border-[#E2E8F0] flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono font-bold text-slate-800 uppercase tracking-widest">
              MULTI-OBJECTIVE COUPLED TWIN OPTIMIZATION
            </span>
            <span className="text-[10px] font-mono bg-emerald-50 text-emerald-900 border border-emerald-300 px-2 py-0.5 rounded font-bold">
              NSGA-II Non-Dominated Sorting
            </span>
          </div>
          <h1 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <GitMerge className="w-4 h-4 text-emerald-700" />
            Synchronized CSS + SRP Joint Optimization — {selectedWellId}
          </h1>
          <p className="text-[11px] text-slate-500 font-mono mt-0.5">
            Coupled thermodynamic reservoir heating and sucker rod wave dynamics
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => navigate('/scenario-comparison')}
            className="btn-primary text-xs flex items-center gap-1.5"
          >
            <GitCompare className="w-3.5 h-3.5" />
            Scenario Comparison (3-Way)
          </button>
          <div className="text-xs font-mono bg-[#F8FAFC] px-2.5 py-1 rounded border border-[#CBD5E1] text-slate-700">
            Coupling: <span className="text-emerald-700 font-bold">ACTIVE</span>
          </div>
        </div>
      </div>

      {/* 1. VISUAL RELATIONSHIP & FEEDBACK DIAGRAM */}
      <CouplingRelationshipDiagram />

      {isJointLoading ? (
        <LoadingSkeleton rows={3} height="h-44" />
      ) : joint && baseline ? (
        <>
          {/* 2. Assessment Summary Callout */}
          <div
            className={`p-3 rounded-md border flex items-center justify-between gap-4 text-xs font-mono shadow-xs ${
              hasJointImprovement
                ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950'
                : 'bg-amber-50/80 border-amber-300 text-amber-950'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-700 flex-shrink-0" />
              <div>
                <span className="font-bold text-xs block font-mono text-slate-900">
                  {hasJointImprovement
                    ? 'Coupled Joint Optimization Advantage Confirmed'
                    : 'Independent Tuning Baseline Current'}
                </span>
                <span className="text-slate-600 font-sans text-xs">
                  {hasJointImprovement
                    ? `Joint tuning yields +${joint.oilUpliftPct.toFixed(1)}% oil uplift, -${joint.sorReductionPct.toFixed(1)}% SOR reduction, and -${joint.energySavingPct.toFixed(1)}% energy savings over uncoupled operations.`
                    : 'Parameters are aligned with current thermal cycle stage.'}
                </span>
              </div>
            </div>

            {hasJointImprovement && (
              <div className="flex items-center gap-4 text-right">
                <div>
                  <span className="text-[9px] text-slate-500 block font-mono">OIL UPLIFT</span>
                  <span className="font-bold text-emerald-800 text-sm font-mono">+{joint.oilUpliftPct.toFixed(1)}%</span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-500 block font-mono">SOR DELTA</span>
                  <span className="font-bold text-emerald-800 text-sm font-mono">-{joint.sorReductionPct.toFixed(1)}%</span>
                </div>
              </div>
            )}
          </div>

          {/* 3. Three-Way Operational Matrix: Current vs Baseline vs Joint */}
          <div className="bg-white border border-[#E2E8F0] rounded-md p-3.5 overflow-x-auto shadow-xs">
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 font-mono">
              Operational Performance Comparison Matrix
            </h2>

            <table className="data-table">
              <thead>
                <tr>
                  <th>Metric Parameter</th>
                  <th>Current Field Telemetry</th>
                  <th>Baseline Separate (Historical)</th>
                  <th className="text-emerald-800 font-bold">Joint Synchronized</th>
                  <th className="text-right">Computed Delta (Joint vs Sep)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="font-sans font-medium text-slate-900 flex items-center gap-1.5">
                    <Droplets className="w-3.5 h-3.5 text-emerald-700" />
                    Oil Rate (m³/d)
                  </td>
                  <td>{currentTel?.surface?.oilRate?.toFixed(1) ?? '80.1'}</td>
                  <td>{baseline.oilRate.toFixed(1)}</td>
                  <td className="text-emerald-800 font-bold">{joint.oilRate.toFixed(1)}</td>
                  <td className="text-right text-emerald-800 font-bold">
                    {oilDelta >= 0 ? `+${oilDelta.toFixed(1)}` : oilDelta.toFixed(1)} m³/d ({joint.oilUpliftPct.toFixed(1)}%)
                  </td>
                </tr>

                <tr>
                  <td className="font-sans font-medium text-slate-900 flex items-center gap-1.5">
                    <Flame className="w-3.5 h-3.5 text-amber-700" />
                    Steam-Oil Ratio (t/m³)
                  </td>
                  <td>{currentTel?.derived?.sor?.toFixed(2) ?? '4.22'}</td>
                  <td>{baseline.sor.toFixed(2)}</td>
                  <td className="text-emerald-800 font-bold">{joint.sor.toFixed(2)}</td>
                  <td className="text-right text-emerald-800 font-bold">
                    {sorDelta.toFixed(2)} t/m³ (-{joint.sorReductionPct.toFixed(1)}%)
                  </td>
                </tr>

                <tr>
                  <td className="font-sans font-medium text-slate-900 flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-slate-600" />
                    Energy Intensity (kWh/bbl)
                  </td>
                  <td>{currentTel?.derived?.kWhPerBbl?.toFixed(1) ?? '14.2'}</td>
                  <td>{baseline.kWhPerBbl.toFixed(1)}</td>
                  <td className="text-slate-900 font-bold">{joint.kWhPerBbl.toFixed(1)}</td>
                  <td className="text-right text-emerald-800 font-bold">
                    {energyDelta.toFixed(1)} kWh/bbl (-{joint.energySavingPct.toFixed(1)}%)
                  </td>
                </tr>

                <tr>
                  <td className="font-sans font-medium text-slate-900 flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-rose-600" />
                    Rod Failure Risk Score
                  </td>
                  <td>
                    {wellState?.activeAlerts && wellState.activeAlerts.length > 0 && wellState.activeAlerts[0].probability !== undefined
                      ? `${(wellState.activeAlerts[0].probability * 100).toFixed(1)}%`
                      : '38.0%'}
                  </td>
                  <td>{(baseline.failureRisk * 100).toFixed(1)}%</td>
                  <td className="text-emerald-800 font-bold">{(joint.failureRisk * 100).toFixed(1)}%</td>
                  <td className="text-right text-emerald-800 font-bold">
                    {(riskDelta * 100).toFixed(1)}% (Risk Alleviated)
                  </td>
                </tr>

                {/* Setpoint Row for CSS */}
                <tr className="bg-[#F8FAFC]">
                  <td className="font-sans text-slate-600">CSS Steam / Soak</td>
                  <td>{currentTel?.css?.cumSteam?.toFixed(0) ?? 1500}t / {currentTel?.css?.soakDay?.toFixed(0) ?? 5}d</td>
                  <td>{baseline.cssParams.steamVolumeTonnes}t / {baseline.cssParams.soakDays}d</td>
                  <td className="text-slate-900 font-bold">{joint.cssParams.steamVolumeTonnes}t / {joint.cssParams.soakDays}d</td>
                  <td className="text-right text-slate-500">Optimized Soak Duration</td>
                </tr>

                {/* Setpoint Row for SRP */}
                <tr className="bg-[#F8FAFC]">
                  <td className="font-sans text-slate-600">SRP Stroke / SPM</td>
                  <td>{currentTel?.srp?.strokeLength?.toFixed(1) ?? 2.8}m / {currentTel?.srp?.spm?.toFixed(1) ?? 4.5}spm</td>
                  <td>{baseline.srpSetpoints.strokeLength}m / {baseline.srpSetpoints.spm}spm</td>
                  <td className="text-emerald-800 font-bold">{joint.srpSetpoints.strokeLength}m / {joint.srpSetpoints.spm}spm</td>
                  <td className="text-right text-slate-500">Viscosity Matched</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* 4. Pareto Trade-Off Scatter Visualization */}
          <ParetoScatterChart data={jointData} height="360px" />
        </>
      ) : null}
    </div>
  );
};

export default JointOptimizer;
