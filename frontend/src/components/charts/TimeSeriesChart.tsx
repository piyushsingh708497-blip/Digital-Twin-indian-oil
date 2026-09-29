// OIL-TWIN AI - Multi-Parameter Telemetry Time Series Chart
// Supports 1h, 6h, 24h, 7d, 30d views with dynamic parameter switching
import React, { useEffect, useRef, useState } from 'react';
import * as echarts from 'echarts';
import type { Telemetry } from '../../types';

export type MetricKey =
  | 'oilRate'
  | 'bhp'
  | 'bht'
  | 'steamRate'
  | 'injPressure'
  | 'waterCutPct'
  | 'rodLoad'
  | 'kW'
  | 'spm';

interface MetricConfig {
  label: string;
  unit: string;
  color: string;
  getValue: (t: Telemetry) => number;
}

const METRICS: Record<MetricKey, MetricConfig> = {
  oilRate: {
    label: 'Oil Rate',
    unit: 'm³/d',
    color: '#10b981',
    getValue: (t) => t.surface?.oilRate ?? 0,
  },
  bhp: {
    label: 'Bottomhole Pressure (BHP)',
    unit: 'bar',
    color: '#06b6d4',
    getValue: (t) => t.wellbore?.bhp ?? 0,
  },
  bht: {
    label: 'Bottomhole Temp (BHT)',
    unit: '°C',
    color: '#f59e0b',
    getValue: (t) => t.wellbore?.bht ?? 0,
  },
  steamRate: {
    label: 'Steam Injection Rate',
    unit: 't/d',
    color: '#3b82f6',
    getValue: (t) => t.css?.steamRate ?? 0,
  },
  injPressure: {
    label: 'Injection Pressure',
    unit: 'bar',
    color: '#8b5cf6',
    getValue: (t) => t.css?.injPressure ?? 0,
  },
  waterCutPct: {
    label: 'Water Cut',
    unit: '%',
    color: '#ec4899',
    getValue: (t) => t.surface?.waterCutPct ?? 0,
  },
  rodLoad: {
    label: 'Rod Load (Max)',
    unit: 'kN',
    color: '#f97316',
    getValue: (t) => t.srp?.rodLoadMax ?? 0,
  },
  kW: {
    label: 'Motor Power',
    unit: 'kW',
    color: '#14b8a6',
    getValue: (t) => t.srp?.kW ?? 0,
  },
  spm: {
    label: 'Strokes Per Minute (SPM)',
    unit: 'spm',
    color: '#eab308',
    getValue: (t) => t.srp?.spm ?? 0,
  },
};

interface TimeSeriesChartProps {
  history: Telemetry[] | undefined;
  activeMetric?: MetricKey;
  onMetricChange?: (metric: MetricKey) => void;
  height?: string;
  selectedRange?: string;
  onRangeChange?: (range: string) => void;
}

export const TimeSeriesChart: React.FC<TimeSeriesChartProps> = ({
  history,
  activeMetric = 'oilRate',
  onMetricChange,
  height = '340px',
  selectedRange = '24h',
  onRangeChange,
}) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);
  const [currentMetric, setCurrentMetric] = useState<MetricKey>(activeMetric);

  const ranges = ['1h', '6h', '24h', '7d', '30d'];

  useEffect(() => {
    setCurrentMetric(activeMetric);
  }, [activeMetric]);

  const metricConfig = METRICS[currentMetric];

  useEffect(() => {
    if (!chartRef.current) return;

    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current, undefined, {
        renderer: 'canvas',
      });
    }

    const chart = chartInstance.current;

    if (!history || history.length === 0) {
      chart.clear();
      return;
    }

    // Filter points based on selected range if timestamps available
    const pointsCountMap: Record<string, number> = {
      '1h': 30,
      '6h': 180,
      '24h': 720,
      '7d': 2000,
      '30d': 5000,
    };
    const maxPoints = pointsCountMap[selectedRange] || 720;
    const sliced = history.slice(-maxPoints);

    const xData = sliced.map((t) => {
      if (t.ts) {
        return t.ts.includes('T') ? t.ts.split('T')[1].slice(0, 8) : t.ts;
      }
      return '';
    });

    const yData = sliced.map((t) => Number(metricConfig.getValue(t).toFixed(2)));

    const option: echarts.EChartsOption = {
      backgroundColor: 'transparent',
      animation: false,
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#FFFFFF',
        borderColor: '#E2E5E9',
        borderWidth: 1,
        extraCssText: 'box-shadow: 0 4px 12px rgba(0,0,0,0.08); border-radius: 8px;',
        textStyle: { color: '#111827', fontFamily: 'JetBrains Mono', fontSize: 11 },
        formatter: (params: any) => {
          if (!Array.isArray(params) || params.length === 0) return '';
          const p = params[0];
          return `<div class="text-xs text-slate-500 mb-0.5">Time: <b class="text-slate-800">${p.name}</b></div>
                  <div style="color:${metricConfig.color}"><b>${metricConfig.label}: ${p.value} ${metricConfig.unit}</b></div>`;
        },
      },
      grid: {
        top: 24,
        left: 54,
        right: 24,
        bottom: 36,
      },
      xAxis: {
        type: 'category',
        data: xData,
        axisLine: { lineStyle: { color: '#CBD5E1' } },
        axisLabel: { color: '#64748B', fontFamily: 'JetBrains Mono', fontSize: 10, interval: 'auto' },
      },
      yAxis: {
        type: 'value',
        name: metricConfig.unit,
        nameTextStyle: { color: '#475569', fontSize: 11 },
        splitLine: { lineStyle: { color: '#E2E5E9', type: 'dashed' } },
        axisLine: { lineStyle: { color: '#CBD5E1' } },
        axisLabel: { color: '#64748B', fontFamily: 'JetBrains Mono', fontSize: 10 },
      },
      series: [
        {
          name: metricConfig.label,
          type: 'line',
          data: yData,
          showSymbol: false,
          smooth: true,
          lineStyle: { color: metricConfig.color, width: 2 },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: `${metricConfig.color}25` },
              { offset: 1, color: `${metricConfig.color}02` },
            ]),
          },
        },
      ],
    };

    chart.setOption(option);

    const handleResize = () => chart.resize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [history, currentMetric, selectedRange, metricConfig]);

  useEffect(() => {
    return () => {
      chartInstance.current?.dispose();
      chartInstance.current = null;
    };
  }, []);

  return (
    <div className="bg-white border border-[#E2E5E9] rounded-xl p-4 flex flex-col shadow-xs">
      {/* Metric Selector & Range Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 mb-3 border-b border-slate-100 pb-2.5">
        {/* Metric Selector Tabs */}
        <div className="flex flex-wrap items-center gap-1">
          {(Object.keys(METRICS) as MetricKey[]).map((key) => {
            const m = METRICS[key];
            const isSelected = key === currentMetric;
            return (
              <button
                key={key}
                onClick={() => {
                  setCurrentMetric(key);
                  if (onMetricChange) onMetricChange(key);
                }}
                className={`px-2 py-1 rounded text-[11px] font-mono transition-colors ${
                  isSelected
                    ? 'bg-amber-100 text-amber-900 font-bold border border-amber-300 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                {m.label}
              </button>
            );
          })}
        </div>

        {/* Time Range Filter Buttons */}
        <div className="flex items-center gap-0.5 bg-slate-50 border border-[#E2E5E9] rounded p-0.5">
          {ranges.map((r) => (
            <button
              key={r}
              onClick={() => onRangeChange && onRangeChange(r)}
              className={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors ${
                selectedRange === r
                  ? 'bg-amber-600 text-white font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div ref={chartRef} style={{ width: '100%', height }} />
    </div>
  );
};
