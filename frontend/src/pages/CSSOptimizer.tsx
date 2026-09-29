// OIL-TWIN AI - Cyclic Steam Stimulation (CSS) Optimization & Forecast
// Evaluates Steam Volume, Injection Pressure, Soak Days, Cutoff Water Cut with Monte Carlo uncertainty
import React, { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Droplets,
  Flame,
  Info,
  Play,
  RotateCcw,
  Sliders,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { forecastCss, getWellState } from '../services/api';
import { useAppStore } from '../store/useAppStore';
import { CssForecastChart } from '../components/charts/CssForecastChart';
import { KpiCard } from '../components/ui/KpiCard';
import { ErrorState, LoadingSkeleton } from '../components/ui/FeedbackStates';
import type { CssForecast, CssParams } from '../types';

export const CSSOptimizer: React.FC = () => {
  const { selectedWellId } = useAppStore();

  // Initial setpoint form state
  const [params, setParams] = useState<CssParams>({
    steamVolumeTonnes: 1500,
    injPressure: 120,
    soakDays: 5,
    productionCutoffWaterCut: 92,
  });

  const [forecastResult, setForecastResult] = useState<CssForecast | null>(null);

  // Fetch well state for context
  const { data: wellState } = useQuery({
    queryKey: ['wellState', selectedWellId],
    queryFn: () => getWellState(selectedWellId),
  });

  // Mutation for forecasting
  const forecastMutation = useMutation({
    mutationFn: (p: CssParams) => forecastCss(selectedWellId, p),
    onSuccess: (data) => {
      setForecastResult(data);
    },
  });

  // Auto-run forecast on first load if not done
  React.useEffect(() => {
    if (!forecastResult && !forecastMutation.isPending) {
      forecastMutation.mutate(params);
    }
  }, [selectedWellId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    forecastMutation.mutate(params);
  };

  const handleReset = () => {
    const defaultParams: CssParams = {
      steamVolumeTonnes: 1500,
      injPressure: 120,
      soakDays: 5,
      productionCutoffWaterCut: 92,
    };
    setParams(defaultParams);
    forecastMutation.mutate(defaultParams);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="p-4 rounded-xl bg-white border border-[#E2E5E9] flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono font-bold text-amber-700 uppercase tracking-widest">
              THERMAL RECOVERY SIMULATOR
            </span>
            <span className="text-[10px] font-mono bg-amber-50 text-amber-900 border border-amber-300 px-2 py-0.5 rounded font-bold">
              Boberg-Lundberg Model
            </span>
          </div>
          <h1 className="text-lg font-bold text-slate-900 tracking-wide flex items-center gap-2">
            <Flame className="w-5 h-5 text-amber-600" />
            CSS Cycle Optimization & What-If Forecast — {selectedWellId}
          </h1>
          <p className="text-xs text-slate-500 font-mono mt-0.5">
            Explore steam volume, injection pressure, and soak time trade-offs for heavy oil viscosity reduction
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-xs font-mono bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700">
            Res Temp: <span className="text-amber-800 font-bold">{wellState?.telemetry?.reservoir?.temperature?.toFixed(1) ?? '48.0'} °C</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Left Controls & Right Forecast */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Parameter Form */}
        <div className="lg:col-span-4 bg-white border border-[#E2E5E9] rounded-xl p-4 space-y-3.5 shadow-xs">
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5 font-mono">
              <Sliders className="w-3.5 h-3.5 text-amber-600" />
              CSS Cycle Inputs
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
            {/* Steam Volume Slider + Number */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="input-label !mb-0 text-slate-700 font-medium">Steam Volume (Tonnes)</label>
                <span className="font-mono text-amber-800 font-bold">
                  {params.steamVolumeTonnes} t
                </span>
              </div>
              <input
                type="range"
                min="300"
                max="3500"
                step="50"
                value={params.steamVolumeTonnes}
                onChange={(e) =>
                  setParams({ ...params, steamVolumeTonnes: Number(e.target.value) })
                }
                className="w-full accent-amber-600 cursor-pointer h-1.5 bg-slate-200 rounded"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-0.5">
                <span>300 t</span>
                <span>1500 t (Nominal)</span>
                <span>3500 t</span>
              </div>
            </div>

            {/* Injection Pressure Slider */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="input-label !mb-0 text-slate-700 font-medium">Injection Pressure (bar)</label>
                <span className="font-mono text-blue-700 font-bold">
                  {params.injPressure} bar
                </span>
              </div>
              <input
                type="range"
                min="50"
                max="200"
                step="5"
                value={params.injPressure}
                onChange={(e) =>
                  setParams({ ...params, injPressure: Number(e.target.value) })
                }
                className="w-full accent-blue-600 cursor-pointer h-1.5 bg-slate-200 rounded"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-0.5">
                <span>50 bar</span>
                <span>120 bar</span>
                <span>200 bar</span>
              </div>
            </div>

            {/* Soak Time Days */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="input-label !mb-0 text-slate-700 font-medium">Soak Period (Days)</label>
                <span className="font-mono text-purple-700 font-bold">
                  {params.soakDays} days
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="21"
                step="1"
                value={params.soakDays}
                onChange={(e) =>
                  setParams({ ...params, soakDays: Number(e.target.value) })
                }
                className="w-full accent-purple-600 cursor-pointer h-1.5 bg-slate-200 rounded"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-0.5">
                <span>1 day</span>
                <span>5-7 days (Optimal)</span>
                <span>21 days</span>
              </div>
            </div>

            {/* Cutoff Water Cut */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="input-label !mb-0 text-slate-700 font-medium">Production Cutoff Water Cut (%)</label>
                <span className="font-mono text-emerald-700 font-bold">
                  {params.productionCutoffWaterCut}%
                </span>
              </div>
              <input
                type="range"
                min="70"
                max="98"
                step="1"
                value={params.productionCutoffWaterCut}
                onChange={(e) =>
                  setParams({ ...params, productionCutoffWaterCut: Number(e.target.value) })
                }
                className="w-full accent-emerald-600 cursor-pointer h-1.5 bg-slate-200 rounded"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-0.5">
                <span>70%</span>
                <span>92%</span>
                <span>98%</span>
              </div>
            </div>

            {/* Submit Run Simulation Button */}
            <button
              type="submit"
              disabled={forecastMutation.isPending}
              className="w-full btn-primary text-xs justify-center py-2.5 mt-2"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              {forecastMutation.isPending ? 'Simulating Physics Twin...' : 'Simulate CSS Forecast'}
            </button>
          </form>

          {/* Technical Guidance */}
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-[11px] text-slate-600 space-y-1">
            <div className="flex items-center gap-1 font-semibold text-slate-800">
              <Info className="w-3.5 h-3.5 text-amber-600" />
              <span>Petroleum Engineering Physics:</span>
            </div>
            <p>
              Under Boberg-Lundberg theory, injected steam heat transfers to rock matrix during the soak period. Viscosity drops by 90%+, leading to elevated peak oil rates that decay as the heated zone cools toward 48°C.
            </p>
          </div>
        </div>

        {/* Right Column: Forecast KPIs and ECharts Curve */}
        <div className="lg:col-span-8 space-y-4">
          {forecastMutation.isPending ? (
            <LoadingSkeleton rows={2} height="h-36" />
          ) : forecastResult ? (
            <>
              {/* Output KPIs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <KpiCard
                  label="Cumulative Oil"
                  value={forecastResult.cumOil?.toFixed(1) ?? '—'}
                  unit="m³"
                  icon={Droplets}
                  highlight="healthy"
                  subtext="P50 Expected Total"
                />
                <KpiCard
                  label="Predicted SOR"
                  value={forecastResult.sor?.toFixed(2) ?? '—'}
                  unit="t/m³"
                  icon={Flame}
                  highlight={forecastResult.sor > 4.5 ? 'warning' : 'default'}
                  subtext="Steam-to-Oil Ratio"
                />
                <KpiCard
                  label="Estimated Energy Cost"
                  value={`₹${(forecastResult.energyCost ? forecastResult.energyCost.toLocaleString('en-IN') : '0')}`}
                  icon={Zap}
                  highlight="default"
                  subtext="Thermal Utility Cost"
                />
                <KpiCard
                  label="P10 / P90 Uncertainty"
                  value={`${forecastResult.band?.p90?.toFixed(0) ?? 0} - ${forecastResult.band?.p10?.toFixed(0) ?? 0}`}
                  unit="m³"
                  icon={TrendingUp}
                  highlight="accent"
                  subtext="Confidence Interval"
                />
              </div>

              {/* Apache ECharts Production Curve */}
              <CssForecastChart forecast={forecastResult} height="360px" />
            </>
          ) : forecastMutation.isError ? (
            <ErrorState
              title="Simulation Failed"
              message="Failed to compute forward CSS production curve. Verify parameter boundaries."
              onRetry={() => forecastMutation.mutate(params)}
            />
          ) : (
            <div className="p-12 text-center text-slate-500 bg-white rounded-xl border border-[#E2E5E9] shadow-xs">
              Click "Simulate CSS Forecast" to evaluate thermal stimulation curves.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CSSOptimizer;
