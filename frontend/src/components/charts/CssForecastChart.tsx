// OIL-TWIN AI - Cyclic Steam Stimulation (CSS) Forecast Chart
// Displays P10, P50, P90 Monte Carlo Production Forecast Curves & Uncertainty Band
import React, { useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import type { CssForecast } from '../../types';

interface CssForecastChartProps {
  forecast: CssForecast | null | undefined;
  height?: string;
}

export const CssForecastChart: React.FC<CssForecastChartProps> = ({
  forecast,
  height = '340px',
}) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!chartRef.current) return;

    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current, undefined, {
        renderer: 'canvas',
      });
    }

    const chart = chartInstance.current;

    if (!forecast || !forecast.oilRateCurve || forecast.oilRateCurve.length === 0) {
      chart.clear();
      return;
    }

    const days = forecast.oilRateCurve.map((pt) => `Day ${pt.day}`);
    const p90 = forecast.oilRateCurve.map((pt) => Number(pt.p90.toFixed(2)));
    const p50 = forecast.oilRateCurve.map((pt) => Number(pt.p50.toFixed(2)));
    const p10 = forecast.oilRateCurve.map((pt) => Number(pt.p10.toFixed(2)));

    const option: echarts.EChartsOption = {
      backgroundColor: 'transparent',
      animation: true,
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#FFFFFF',
        borderColor: '#E2E5E9',
        borderWidth: 1,
        extraCssText: 'box-shadow: 0 4px 12px rgba(0,0,0,0.08); border-radius: 8px;',
        textStyle: { color: '#111827', fontFamily: 'JetBrains Mono', fontSize: 11 },
        formatter: (params: any) => {
          if (!Array.isArray(params) || params.length === 0) return '';
          let text = `<div class="font-bold text-slate-800 mb-1">${params[0].name} Production Rate</div>`;
          params.forEach((item: any) => {
            text += `<div style="color:${item.color}">${item.seriesName}: <b>${item.value} m³/d</b></div>`;
          });
          return text;
        },
      },
      legend: {
        top: 0,
        right: 0,
        textStyle: { color: '#475569', fontSize: 11 },
        data: ['P90 (Conservative)', 'P50 (Expected Base)', 'P10 (Optimistic)'],
      },
      grid: {
        top: 36,
        left: 50,
        right: 20,
        bottom: 36,
      },
      xAxis: {
        type: 'category',
        data: days,
        axisLine: { lineStyle: { color: '#CBD5E1' } },
        axisLabel: { color: '#64748B', fontFamily: 'JetBrains Mono', fontSize: 10 },
      },
      yAxis: {
        type: 'value',
        name: 'Oil Rate (m³/d)',
        nameTextStyle: { color: '#475569', fontSize: 11 },
        splitLine: { lineStyle: { color: '#E2E5E9', type: 'dashed' } },
        axisLine: { lineStyle: { color: '#CBD5E1' } },
        axisLabel: { color: '#64748B', fontFamily: 'JetBrains Mono', fontSize: 10 },
      },
      series: [
        {
          name: 'P10 (Optimistic)',
          type: 'line',
          data: p10,
          smooth: true,
          showSymbol: false,
          lineStyle: { color: '#2563EB', width: 2, type: 'dashed' },
        },
        {
          name: 'P50 (Expected Base)',
          type: 'line',
          data: p50,
          smooth: true,
          showSymbol: false,
          lineStyle: { color: '#16A34A', width: 2.5 },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(22, 163, 74, 0.18)' },
              { offset: 1, color: 'rgba(22, 163, 74, 0.01)' },
            ]),
          },
        },
        {
          name: 'P90 (Conservative)',
          type: 'line',
          data: p90,
          smooth: true,
          showSymbol: false,
          lineStyle: { color: '#D97706', width: 2, type: 'dotted' },
        },
      ],
    };

    chart.setOption(option);

    const handleResize = () => chart.resize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [forecast]);

  useEffect(() => {
    return () => {
      chartInstance.current?.dispose();
      chartInstance.current = null;
    };
  }, []);

  return (
    <div className="bg-white border border-[#E2E5E9] rounded-xl p-4 flex flex-col shadow-xs">
      <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-100">
        <span className="text-[11px] font-mono font-semibold text-slate-700 uppercase tracking-wider">
          CSS Production Forecast Curve & Uncertainty
        </span>
        <span className="text-[10px] font-mono text-slate-600 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
          Boberg-Lundberg Coupled Surrogate
        </span>
      </div>
      <div ref={chartRef} style={{ width: '100%', height }} />
    </div>
  );
};
