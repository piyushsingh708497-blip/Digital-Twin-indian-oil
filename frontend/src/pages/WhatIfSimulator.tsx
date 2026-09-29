// OIL-TWIN AI - What-If Decision Simulator Page
// Allows testing coupled CSS + SRP operating parameters and viewing predicted outcomes
// Strict parameter validation according to backend schemas; no fake calculations

import React, { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import * as echarts from 'echarts';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Droplets,
  Flame,
  Gauge,
  HelpCircle,
  Play,
  RotateCcw,
  Sparkles,
  Zap,
} from 'lucide-react';
import { analyzeSrp, forecastCss, getWellState } from '../services/api';
import { useAppStore } from '../store/useAppStore';
import { ErrorState, LoadingSkeleton } from '../components/ui/FeedbackStates';
import type {
  CssForecast,
  CssParams,
  SrpAnalysis,
  SrpSetpoints,
} from '../types';

// Parameter operational limits enforced by backend Pydantic schemas
const LIMITS = {
  steamVolumeTonnes: { min: 100.0, max: 5000.0, step: 50.0, unit: 't', label: 'Steam Volume' },
  injPressure: { min: 10.0, max: 250.0, step: 5.0, unit: 'bar', label: 'Injection Pressure' },
  soakDays: { min: 1.0, max: 30.0, step: 1.0, unit: 'days', label: 'Soak Duration' },
  productionCutoffWaterCut: { min: 50.0, max: 99.0, step: 1.0, unit: '%', label: 'Cutoff Water Cut' },
  strokeLength: { min: 0.5, max: 4.5, step: 0.1, unit: 'm', label: 'Stroke Length' },
  spm: { min: 1.0, max: 15.0, step: 0.2, unit: 'spm', label: 'Pumping Speed' },
  vfdHz: { min: 10.0, max: 70.0, step: 1.0, unit: 'Hz', label: 'VFD Frequency' },
};

export const WhatIfSimulator: React.FC = () => {
  const { selectedWellId } = useAppStore();

  // Fetch Current Field State as baseline comparison
  const {
    data: wellState,
    isError: isStateError,
    refetch: refetchState,
  } = useQuery({
    queryKey: ['wellState', selectedWellId],
    queryFn: () => getWellState(selectedWellId),
    refetchInterval: 15000,
  });

  const tel = wellState?.telemetry;

  // CSS Inputs State
  const [cssParams, setCssParams] = useState<CssParams>({
    steamVolumeTonnes: 1800.0,
    injPressure: 140.0,
    soakDays: 8.0,
    productionCutoffWaterCut: 90.0,
  });

  // SRP Inputs State
  const [srpSetpoints, setSrpSetpoints] = useState<SrpSetpoints>({
    strokeLength: 2.8,
    spm: 4.5,
    vfdHz: 45.0,
  });

  // Simulation Results State (strictly from backend APIs)
  const [cssResult, setCssResult] = useState<CssForecast | null>(null);
  const [srpResult, setSrpResult] = useState<SrpAnalysis | null>(null);

  // Sync initial inputs when wellState loads
  useEffect(() => {
    if (tel) {
      setCssParams({
        steamVolumeTonnes:
          tel.css.cumSteam && tel.css.cumSteam >= LIMITS.steamVolumeTonnes.min
            ? Math.min(LIMITS.steamVolumeTonnes.max, tel.css.cumSteam)
            : 1800.0,
        injPressure:
          tel.css.injPressure && tel.css.injPressure >= LIMITS.injPressure.min
            ? Math.min(LIMITS.injPressure.max, tel.css.injPressure)
            : 140.0,
        soakDays:
          tel.css.soakDay && tel.css.soakDay >= LIMITS.soakDays.min
            ? Math.min(LIMITS.soakDays.max, tel.css.soakDay)
            : 8.0,
        productionCutoffWaterCut: 90.0,
      });

      setSrpSetpoints({
        strokeLength:
          tel.srp.strokeLength && tel.srp.strokeLength >= LIMITS.strokeLength.min
            ? Math.min(LIMITS.strokeLength.max, tel.srp.strokeLength)
            : 2.8,
        spm:
          tel.srp.spm && tel.srp.spm >= LIMITS.spm.min
            ? Math.min(LIMITS.spm.max, tel.srp.spm)
            : 4.5,
        vfdHz:
          tel.srp.vfdHz && tel.srp.vfdHz >= LIMITS.vfdHz.min
            ? Math.min(LIMITS.vfdHz.max, tel.srp.vfdHz)
            : 45.0,
      });
    }
  }, [selectedWellId, tel]);

  // Simulation Mutation calling existing backend APIs
  const simulateMutation = useMutation({
    mutationFn: async () => {
      const [cssResp, srpResp] = await Promise.all([
        forecastCss(selectedWellId, cssParams),
        analyzeSrp(selectedWellId, srpSetpoints),
      ]);
      return { cssResp, srpResp };
    },
    onSuccess: (data) => {
      setCssResult(data.cssResp);
      setSrpResult(data.srpResp);
    },
  });

  // Parameter validation checks against strict limits
  const isValid =
    cssParams.steamVolumeTonnes >= LIMITS.steamVolumeTonnes.min &&
    cssParams.steamVolumeTonnes <= LIMITS.steamVolumeTonnes.max &&
    cssParams.injPressure >= LIMITS.injPressure.min &&
    cssParams.injPressure <= LIMITS.injPressure.max &&
    cssParams.soakDays >= LIMITS.soakDays.min &&
    cssParams.soakDays <= LIMITS.soakDays.max &&
    cssParams.productionCutoffWaterCut >= LIMITS.productionCutoffWaterCut.min &&
    cssParams.productionCutoffWaterCut <= LIMITS.productionCutoffWaterCut.max &&
    srpSetpoints.strokeLength >= LIMITS.strokeLength.min &&
    srpSetpoints.strokeLength <= LIMITS.strokeLength.max &&
    srpSetpoints.spm >= LIMITS.spm.min &&
    srpSetpoints.spm <= LIMITS.spm.max &&
    srpSetpoints.vfdHz >= LIMITS.vfdHz.min &&
    srpSetpoints.vfdHz <= LIMITS.vfdHz.max;

  // Comparison Chart ECharts Reference
  const chartRef = useRef<HTMLDivElement | null>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!chartRef.current) return;
    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current, undefined, { renderer: 'canvas' });
    }

    const currentOil = tel?.surface?.oilRate ?? 0;
    const whatIfOil = srpResult?.predictedOilRate ?? 0;

    const currentSor = tel?.derived?.sor ?? 0;
    const whatIfSor = cssResult?.sor ?? 0;

    const currentEnergy = tel?.srp?.kW ?? 0;
    const whatIfEnergy = srpResult?.kW ?? 0;

    const currentRisk =
      wellState?.activeAlerts && wellState.activeAlerts.length > 0
        ? (wellState.activeAlerts[0].probability ?? 0.15) * 100
        : 15;
    const whatIfRisk = srpResult ? srpResult.failureRisk * 100 : 0;

    const option: echarts.EChartsOption = {
      backgroundColor: '#FFFFFF',
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: '#FFFFFF',
        borderColor: '#E2E5E9',
        borderWidth: 1,
        textStyle: { color: '#111827', fontSize: 12, fontFamily: 'monospace' },
        padding: [8, 12],
      },
      legend: {
        data: ['Current Operating Baseline', 'What-If Simulated Scenario'],
        top: 8,
        right: 16,
        textStyle: { color: '#475569', fontSize: 11 },
      },
      grid: {
        top: 48,
        left: '4%',
        right: '4%',
        bottom: '8%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: ['Oil Rate (m³/d)', 'SOR (t/m³)', 'Power Demand (kW)', 'Failure Risk (%)'],
        axisLine: { lineStyle: { color: '#CBD5E1' } },
        axisLabel: { color: '#475569', fontSize: 11, fontFamily: 'monospace' },
      },
      yAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: '#F1F5F9', type: 'dashed' } },
        axisLabel: { color: '#64748B', fontSize: 10, fontFamily: 'monospace' },
      },
      series: [
        {
          name: 'Current Operating Baseline',
          type: 'bar',
          data: [
            Number(currentOil.toFixed(1)),
            Number(currentSor.toFixed(2)),
            Number(currentEnergy.toFixed(1)),
            Number(currentRisk.toFixed(1)),
          ],
          itemStyle: { color: '#94A3B8', borderRadius: [4, 4, 0, 0] },
          barMaxWidth: 36,
        },
        {
          name: 'What-If Simulated Scenario',
          type: 'bar',
          data: [
            Number(whatIfOil.toFixed(1)),
            Number(whatIfSor.toFixed(2)),
            Number(whatIfEnergy.toFixed(1)),
            Number(whatIfRisk.toFixed(1)),
          ],
          itemStyle: { color: '#D97706', borderRadius: [4, 4, 0, 0] },
          barMaxWidth: 36,
        },
      ],
    };

    chartInstance.current.setOption(option, true);

    const handleResize = () => chartInstance.current?.resize();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [tel, cssResult, srpResult, wellState]);

  if (isStateError) {
    return (
      <ErrorState
        title="Simulation Service Unavailable"
        message="Could not load well baseline data from the physics engine."
        onRetry={refetchState}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* ════ HEADER & DISCLAIMER ════ */}
      <div className="p-4 rounded-xl bg-white border border-[#E2E5E9] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono font-bold text-amber-700 uppercase tracking-widest">
              DECISION SUPPORT LABORATORY
            </span>
            <span className="text-[10px] font-mono bg-amber-50 text-amber-900 border border-amber-300 px-2 py-0.5 rounded font-bold">
              SIMULATED WHAT-IF SCENARIO
            </span>
          </div>
          <h1 className="text-lg font-bold text-slate-900 tracking-wide flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-600" />
            CSS + SRP What-If Operating Scenario Simulator — {selectedWellId}
          </h1>
          <p className="text-xs text-slate-500 font-mono mt-0.5">
            Test arbitrary injection and lifting setpoints before committing decisions to physical SCADA controllers
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-slate-500 bg-[#F8F9FA] px-3 py-1.5 rounded-lg border border-[#E2E5E9]">
          <span>Target Well:</span>
          <span className="font-bold text-slate-900">{selectedWellId}</span>
        </div>
      </div>

      {/* Mandatory Simulation Transparency Label */}
      <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl flex items-center gap-2.5 text-xs text-amber-900 font-mono shadow-2xs">
        <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
        <span>
          <b>SIMULATED WHAT-IF SCENARIO:</b> Outputs represent numerical physics model predictions (Boberg-Lundberg thermal surrogate & 1D wave mechanics). Not guaranteed field production.
        </span>
      </div>

      {/* ════ INPUT CONTROLS PANEL ════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CSS Parameters Column */}
        <div className="bg-white border border-[#E2E5E9] rounded-xl p-5 space-y-4 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-[#E2E5E9]">
            <span className="text-xs font-bold text-slate-900 uppercase tracking-wider font-mono flex items-center gap-2">
              <Flame className="w-4 h-4 text-amber-600" />
              Cyclic Steam Stimulation (CSS) Setpoints
            </span>
            <span className="text-[10px] font-mono text-slate-500">Thermal Subsystem</span>
          </div>

          <div className="space-y-3.5">
            {/* Steam Volume */}
            <div>
              <div className="flex justify-between text-xs font-mono mb-1">
                <span className="text-slate-700 font-medium">Steam Volume</span>
                <span className="font-bold text-amber-800">{cssParams.steamVolumeTonnes} tonnes</span>
              </div>
              <input
                type="range"
                min={LIMITS.steamVolumeTonnes.min}
                max={LIMITS.steamVolumeTonnes.max}
                step={LIMITS.steamVolumeTonnes.step}
                value={cssParams.steamVolumeTonnes}
                onChange={(e) =>
                  setCssParams({ ...cssParams, steamVolumeTonnes: Number(e.target.value) })
                }
                className="w-full accent-amber-600 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400 font-mono mt-0.5">
                <span>{LIMITS.steamVolumeTonnes.min} t</span>
                <span>{LIMITS.steamVolumeTonnes.max} t</span>
              </div>
            </div>

            {/* Injection Pressure */}
            <div>
              <div className="flex justify-between text-xs font-mono mb-1">
                <span className="text-slate-700 font-medium">Injection Pressure</span>
                <span className="font-bold text-amber-800">{cssParams.injPressure} bar</span>
              </div>
              <input
                type="range"
                min={LIMITS.injPressure.min}
                max={LIMITS.injPressure.max}
                step={LIMITS.injPressure.step}
                value={cssParams.injPressure}
                onChange={(e) =>
                  setCssParams({ ...cssParams, injPressure: Number(e.target.value) })
                }
                className="w-full accent-amber-600 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400 font-mono mt-0.5">
                <span>{LIMITS.injPressure.min} bar</span>
                <span>{LIMITS.injPressure.max} bar</span>
              </div>
            </div>

            {/* Soak Duration */}
            <div>
              <div className="flex justify-between text-xs font-mono mb-1">
                <span className="text-slate-700 font-medium">Soak Duration</span>
                <span className="font-bold text-amber-800">{cssParams.soakDays} days</span>
              </div>
              <input
                type="range"
                min={LIMITS.soakDays.min}
                max={LIMITS.soakDays.max}
                step={LIMITS.soakDays.step}
                value={cssParams.soakDays}
                onChange={(e) =>
                  setCssParams({ ...cssParams, soakDays: Number(e.target.value) })
                }
                className="w-full accent-amber-600 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400 font-mono mt-0.5">
                <span>{LIMITS.soakDays.min} d</span>
                <span>{LIMITS.soakDays.max} d</span>
              </div>
            </div>

            {/* Production Cutoff Water Cut */}
            <div>
              <div className="flex justify-between text-xs font-mono mb-1">
                <span className="text-slate-700 font-medium">Cutoff Water Cut</span>
                <span className="font-bold text-amber-800">{cssParams.productionCutoffWaterCut}%</span>
              </div>
              <input
                type="range"
                min={LIMITS.productionCutoffWaterCut.min}
                max={LIMITS.productionCutoffWaterCut.max}
                step={LIMITS.productionCutoffWaterCut.step}
                value={cssParams.productionCutoffWaterCut}
                onChange={(e) =>
                  setCssParams({ ...cssParams, productionCutoffWaterCut: Number(e.target.value) })
                }
                className="w-full accent-amber-600 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400 font-mono mt-0.5">
                <span>{LIMITS.productionCutoffWaterCut.min}%</span>
                <span>{LIMITS.productionCutoffWaterCut.max}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* SRP Parameters Column */}
        <div className="bg-white border border-[#E2E5E9] rounded-xl p-5 space-y-4 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-[#E2E5E9]">
            <span className="text-xs font-bold text-slate-900 uppercase tracking-wider font-mono flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-600" />
              Sucker Rod Pump (SRP) Setpoints
            </span>
            <span className="text-[10px] font-mono text-slate-500">Mechanical Subsystem</span>
          </div>

          <div className="space-y-3.5">
            {/* Stroke Length */}
            <div>
              <div className="flex justify-between text-xs font-mono mb-1">
                <span className="text-slate-700 font-medium">Stroke Length</span>
                <span className="font-bold text-emerald-800">{srpSetpoints.strokeLength} m</span>
              </div>
              <input
                type="range"
                min={LIMITS.strokeLength.min}
                max={LIMITS.strokeLength.max}
                step={LIMITS.strokeLength.step}
                value={srpSetpoints.strokeLength}
                onChange={(e) =>
                  setSrpSetpoints({ ...srpSetpoints, strokeLength: Number(e.target.value) })
                }
                className="w-full accent-emerald-600 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400 font-mono mt-0.5">
                <span>{LIMITS.strokeLength.min} m</span>
                <span>{LIMITS.strokeLength.max} m</span>
              </div>
            </div>

            {/* SPM */}
            <div>
              <div className="flex justify-between text-xs font-mono mb-1">
                <span className="text-slate-700 font-medium">Strokes Per Minute (SPM)</span>
                <span className="font-bold text-emerald-800">{srpSetpoints.spm} spm</span>
              </div>
              <input
                type="range"
                min={LIMITS.spm.min}
                max={LIMITS.spm.max}
                step={LIMITS.spm.step}
                value={srpSetpoints.spm}
                onChange={(e) =>
                  setSrpSetpoints({ ...srpSetpoints, spm: Number(e.target.value) })
                }
                className="w-full accent-emerald-600 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400 font-mono mt-0.5">
                <span>{LIMITS.spm.min} spm</span>
                <span>{LIMITS.spm.max} spm</span>
              </div>
            </div>

            {/* VFD Frequency */}
            <div>
              <div className="flex justify-between text-xs font-mono mb-1">
                <span className="text-slate-700 font-medium">VFD Frequency</span>
                <span className="font-bold text-emerald-800">{srpSetpoints.vfdHz} Hz</span>
              </div>
              <input
                type="range"
                min={LIMITS.vfdHz.min}
                max={LIMITS.vfdHz.max}
                step={LIMITS.vfdHz.step}
                value={srpSetpoints.vfdHz}
                onChange={(e) =>
                  setSrpSetpoints({ ...srpSetpoints, vfdHz: Number(e.target.value) })
                }
                className="w-full accent-emerald-600 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400 font-mono mt-0.5">
                <span>{LIMITS.vfdHz.min} Hz</span>
                <span>{LIMITS.vfdHz.max} Hz</span>
              </div>
            </div>

            {/* Action Trigger Buttons */}
            <div className="pt-3 border-t border-[#E2E5E9] flex items-center gap-3">
              <button
                type="button"
                onClick={() => simulateMutation.mutate()}
                disabled={!isValid || simulateMutation.isPending}
                className="btn-primary text-xs flex-1 justify-center py-2.5 flex items-center gap-2 shadow-xs"
              >
                <Play className="w-4 h-4 fill-current" />
                {simulateMutation.isPending ? 'Calculating...' : 'Run Simulation'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setCssResult(null);
                  setSrpResult(null);
                }}
                className="btn-secondary text-xs px-3 py-2.5"
                title="Reset simulation outputs"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ════ SIMULATION OUTPUTS ════ */}
      {simulateMutation.isPending ? (
        <LoadingSkeleton rows={3} height="h-28" />
      ) : cssResult && srpResult ? (
        <div className="space-y-6">
          {/* Output KPI Sections */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider font-mono">
                Predicted Scenario Consequences (Coupled Output)
              </h2>
              <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                Simulation Complete
              </span>
            </div>

            {/* 3 Categories: Production, Efficiency, Reliability */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* 1. Production */}
              <div className="p-4 bg-white border border-[#E2E5E9] rounded-xl space-y-3 shadow-xs">
                <div className="flex items-center gap-2 text-xs font-bold font-mono text-emerald-800 pb-2 border-b border-slate-100">
                  <Droplets className="w-4 h-4 text-emerald-600" />
                  <span>PRODUCTION PERFORMANCE</span>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs text-slate-500 font-mono">Predicted Oil Rate:</span>
                    <span className="text-lg font-bold font-mono text-slate-900">
                      {srpResult.predictedOilRate.toFixed(1)} <span className="text-xs font-normal">m³/d</span>
                    </span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs text-slate-500 font-mono">Cumulative Oil:</span>
                    <span className="text-sm font-bold font-mono text-slate-800">
                      {cssResult.cumOil.toFixed(1)} <span className="text-xs font-normal">m³</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* 2. Efficiency */}
              <div className="p-4 bg-white border border-[#E2E5E9] rounded-xl space-y-3 shadow-xs">
                <div className="flex items-center gap-2 text-xs font-bold font-mono text-blue-800 pb-2 border-b border-slate-100">
                  <Flame className="w-4 h-4 text-blue-600" />
                  <span>THERMAL & ENERGY EFFICIENCY</span>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs text-slate-500 font-mono">Steam-Oil Ratio (SOR):</span>
                    <span className="text-lg font-bold font-mono text-slate-900">
                      {cssResult.sor.toFixed(2)} <span className="text-xs font-normal">t/m³</span>
                    </span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs text-slate-500 font-mono">Lifting Power / Energy:</span>
                    <span className="text-sm font-bold font-mono text-slate-800">
                      {srpResult.kW.toFixed(1)} <span className="text-xs font-normal">kW</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* 3. Reliability */}
              <div className="p-4 bg-white border border-[#E2E5E9] rounded-xl space-y-3 shadow-xs">
                <div className="flex items-center gap-2 text-xs font-bold font-mono text-amber-800 pb-2 border-b border-slate-100">
                  <Gauge className="w-4 h-4 text-amber-600" />
                  <span>MECHANICAL RELIABILITY</span>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs text-slate-500 font-mono">Failure Risk:</span>
                    <span
                      className={`text-lg font-bold font-mono ${
                        srpResult.failureRisk > 0.5 ? 'text-red-700' : 'text-slate-900'
                      }`}
                    >
                      {(srpResult.failureRisk * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs text-slate-500 font-mono">Cyclic Rod Stress:</span>
                    <span className="text-sm font-bold font-mono text-slate-800">
                      {srpResult.rodStressPct.toFixed(1)}% <span className="text-xs font-normal">Goodman</span>
                    </span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs text-slate-500 font-mono">Pump Fillage:</span>
                    <span className="text-sm font-bold font-mono text-slate-800">
                      {tel?.srp?.pumpFillagePct !== undefined
                        ? `${tel.srp.pumpFillagePct.toFixed(0)}%`
                        : 'Data unavailable'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Uncertainty Band Display: P10 / P50 / P90 */}
          <div className="bg-white border border-[#E2E5E9] rounded-xl p-4 space-y-2 shadow-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="text-xs font-mono font-bold text-slate-800 uppercase flex items-center gap-2">
                <HelpCircle className="w-3.5 h-3.5 text-blue-600" />
                Cumulative Production Uncertainty Distribution (Monte Carlo)
              </span>
              <span className="text-[10px] font-mono text-slate-500">Uncertainty Envelope</span>
            </div>

            {cssResult.band ? (
              <div className="grid grid-cols-3 gap-3 pt-1">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-center">
                  <span className="text-[10px] font-mono text-slate-500 block">P10 (Pessimistic)</span>
                  <span className="text-base font-bold font-mono text-slate-800">
                    {cssResult.band.p10.toFixed(1)} m³
                  </span>
                </div>
                <div className="p-3 bg-amber-50/50 border border-amber-200 rounded-lg text-center">
                  <span className="text-[10px] font-mono text-amber-800 block font-semibold">P50 (Expected)</span>
                  <span className="text-base font-bold font-mono text-amber-900">
                    {cssResult.band.p50.toFixed(1)} m³
                  </span>
                </div>
                <div className="p-3 bg-emerald-50/50 border border-emerald-200 rounded-lg text-center">
                  <span className="text-[10px] font-mono text-emerald-800 block font-semibold">P90 (Optimistic)</span>
                  <span className="text-base font-bold font-mono text-emerald-900">
                    {cssResult.band.p90.toFixed(1)} m³
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-xs font-mono text-slate-500 py-2">
                Uncertainty distribution: Data unavailable
              </div>
            )}
          </div>

          {/* ════ COMPARISON CHART: CURRENT VS WHAT-IF ════ */}
          <div className="bg-white border border-[#E2E5E9] rounded-xl p-4 space-y-3 shadow-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-600" />
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider font-mono">
                  Comparative Analysis: Current Operating Baseline vs What-If Scenario
                </h3>
              </div>
              <span className="text-[10px] font-mono text-slate-400">
                Coupled Multi-Metric Comparison
              </span>
            </div>

            <div ref={chartRef} className="w-full h-72" />
          </div>

          {/* Engineering Warnings if any */}
          {srpResult.warnings && srpResult.warnings.length > 0 && (
            <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl space-y-1.5 shadow-xs">
              <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5 font-mono">
                <AlertTriangle className="w-4 h-4 text-amber-700" />
                SIMULATOR OPERATIONAL WARNINGS ({srpResult.warnings.length})
              </span>
              <ul className="text-xs text-amber-900 font-mono list-disc list-inside space-y-0.5">
                {srpResult.warnings.map((w, idx) => (
                  <li key={idx}>{w}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white border border-[#E2E5E9] rounded-xl p-8 text-center space-y-3 shadow-xs">
          <div className="w-12 h-12 rounded-full bg-slate-50 border border-slate-200 text-slate-400 flex items-center justify-center mx-auto">
            <Sparkles className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 font-mono">Ready to Simulate Scenario</h3>
            <p className="text-xs text-slate-500 font-sans max-w-md mx-auto mt-1">
              Adjust the CSS injection and SRP pumping sliders above and click "Run Simulation" to evaluate predicted consequences against live field telemetry.
            </p>
          </div>
          <button
            type="button"
            onClick={() => simulateMutation.mutate()}
            disabled={!isValid || simulateMutation.isPending}
            className="btn-primary text-xs inline-flex items-center gap-2 px-4 py-2"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Run Simulation Now</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default WhatIfSimulator;
