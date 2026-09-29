// OIL-TWIN AI - Multi-Objective Pareto Scatter Visualization
// Plots Oil Rate (m³/d) vs Energy (kWh/bbl) or Failure Risk, highlighting Baseline vs Joint Optimum
import React, { useEffect, useRef, useState } from 'react';
import * as echarts from 'echarts';
import type { JointResponse } from '../../types';

interface ParetoScatterChartProps {
  data: JointResponse | null | undefined;
  height?: string;
}

export const ParetoScatterChart: React.FC<ParetoScatterChartProps> = ({
  data,
  height = '360px',
}) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);
  const [yAxisMetric, setYAxisMetric] = useState<'energy' | 'risk'>('energy');

  useEffect(() => {
    if (!chartRef.current) return;

    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current, undefined, {
        renderer: 'canvas',
      });
    }

    const chart = chartInstance.current;

    if (!data || !data.pareto || data.pareto.length === 0) {
      chart.clear();
      return;
    }

    // Pareto candidate points: [oil, yValue, rawPoint]
    const candidates = data.pareto.map((p) => [
      Number(p.oil.toFixed(1)),
      Number((yAxisMetric === 'energy' ? p.energy : p.risk * 100).toFixed(1)),
      p,
    ]);

    // Baseline point
    const baseline = data.baselineSeparate;
    const baselinePoint = [
      Number(baseline.oilRate.toFixed(1)),
      Number((yAxisMetric === 'energy' ? baseline.kWhPerBbl : baseline.failureRisk * 100).toFixed(1)),
      baseline,
    ];

    // Joint point
    const joint = data.jointOptimized;
    const jointPoint = [
      Number(joint.oilRate.toFixed(1)),
      Number((yAxisMetric === 'energy' ? joint.kWhPerBbl : joint.failureRisk * 100).toFixed(1)),
      joint,
    ];

    const yLabel = yAxisMetric === 'energy' ? 'Energy Intensity (kWh/bbl)' : 'Failure Risk (%)';

    const option: echarts.EChartsOption = {
      backgroundColor: 'transparent',
      animation: true,
      tooltip: {
        trigger: 'item',
        backgroundColor: '#FFFFFF',
        borderColor: '#E2E5E9',
        borderWidth: 1,
        extraCssText: 'box-shadow: 0 4px 12px rgba(0,0,0,0.08); border-radius: 8px;',
        textStyle: { color: '#111827', fontFamily: 'JetBrains Mono', fontSize: 11 },
        formatter: (params: any) => {
          const val = params.value;
          const p = val[2];
          return `
            <div class="font-bold text-amber-800 mb-1">${params.seriesName}</div>
            <div>Oil Rate: <b>${val[0]} m³/d</b></div>
            <div>${yLabel}: <b>${val[1]}</b></div>
            ${p.cssParams ? `<div class="text-[10px] text-slate-500 mt-1">Steam: ${p.cssParams.steamVolumeTonnes} t | Soak: ${p.cssParams.soakDays} d</div>` : ''}
            ${p.srpSetpoints ? `<div class="text-[10px] text-slate-500">Stroke: ${p.srpSetpoints.strokeLength} m | SPM: ${p.srpSetpoints.spm}</div>` : ''}
          `;
        },
      },
      legend: {
        top: 0,
        right: 0,
        textStyle: { color: '#475569', fontSize: 11 },
        data: ['Pareto Front Candidates', 'Baseline (Separate Tuning)', 'Joint Coupled Optimum'],
      },
      grid: {
        top: 36,
        left: 54,
        right: 24,
        bottom: 40,
      },
      xAxis: {
        type: 'value',
        name: 'Oil Production Rate (m³/d)',
        nameLocation: 'middle',
        nameGap: 26,
        nameTextStyle: { color: '#475569', fontSize: 11 },
        splitLine: { lineStyle: { color: '#E2E5E9', type: 'dashed' } },
        axisLine: { lineStyle: { color: '#CBD5E1' } },
        axisLabel: { color: '#64748B', fontFamily: 'JetBrains Mono', fontSize: 10 },
      },
      yAxis: {
        type: 'value',
        name: yLabel,
        nameTextStyle: { color: '#475569', fontSize: 11 },
        splitLine: { lineStyle: { color: '#E2E5E9', type: 'dashed' } },
        axisLine: { lineStyle: { color: '#CBD5E1' } },
        axisLabel: { color: '#64748B', fontFamily: 'JetBrains Mono', fontSize: 10 },
      },
      series: [
        {
          name: 'Pareto Front Candidates',
          type: 'scatter',
          data: candidates as any,
          symbolSize: 8,
          itemStyle: {
            color: '#2563EB',
            opacity: 0.7,
          },
        },
        {
          name: 'Baseline (Separate Tuning)',
          type: 'scatter',
          data: [baselinePoint] as any,
          symbolSize: 16,
          symbol: 'diamond',
          itemStyle: {
            color: '#DC2626',
            borderColor: '#FFFFFF',
            borderWidth: 1.5,
          },
        },
        {
          name: 'Joint Coupled Optimum',
          type: 'scatter',
          data: [jointPoint] as any,
          symbolSize: 18,
          symbol: 'star',
          itemStyle: {
            color: '#16A34A',
            borderColor: '#FFFFFF',
            borderWidth: 2,
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
  }, [data, yAxisMetric]);

  useEffect(() => {
    return () => {
      chartInstance.current?.dispose();
      chartInstance.current = null;
    };
  }, []);

  return (
    <div className="bg-white border border-[#E2E5E9] rounded-xl p-4 flex flex-col shadow-xs">
      <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
        <span className="text-[11px] font-mono font-semibold text-slate-700 uppercase tracking-wider">
          Multi-Objective Pareto Front Trade-Off
        </span>
        <div className="flex items-center gap-0.5 bg-slate-50 border border-[#E2E5E9] rounded p-0.5">
          <button
            onClick={() => setYAxisMetric('energy')}
            className={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors ${
              yAxisMetric === 'energy'
                ? 'bg-amber-600 text-white font-bold shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            vs Energy Intensity
          </button>
          <button
            onClick={() => setYAxisMetric('risk')}
            className={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors ${
              yAxisMetric === 'risk'
                ? 'bg-amber-600 text-white font-bold shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            vs Failure Risk
          </button>
        </div>
      </div>

      <div ref={chartRef} style={{ width: '100%', height }} />
    </div>
  );
};
