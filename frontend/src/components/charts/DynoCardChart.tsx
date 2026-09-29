// OIL-TWIN AI - High-Resolution Dynamometer Card Chart
// Plots Surface and Downhole Load (kN) vs Position (m) with Diagnosis Banner
import React, { useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import type { DynoCard } from '../../types';

interface DynoCardChartProps {
  dynoCard: DynoCard | null | undefined;
  height?: string;
  title?: string;
}

export const DynoCardChart: React.FC<DynoCardChartProps> = ({
  dynoCard,
  height = '340px',
  title = 'Dynamometer Card (Surface & Downhole)',
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

    if (!dynoCard || !dynoCard.surface || dynoCard.surface.length === 0) {
      chart.clear();
      return;
    }

    const surfaceData = dynoCard.surface.map((p) => [p.position, p.load]);
    // Close the loop if not already closed
    if (surfaceData.length > 0 && (surfaceData[0][0] !== surfaceData[surfaceData.length - 1][0])) {
      surfaceData.push(surfaceData[0]);
    }

    const downholeData = (dynoCard.downhole || []).map((p) => [p.position, p.load]);
    if (downholeData.length > 0 && (downholeData[0][0] !== downholeData[downholeData.length - 1][0])) {
      downholeData.push(downholeData[0]);
    }

    const option: echarts.EChartsOption = {
      backgroundColor: 'transparent',
      animation: false,
      title: {
        text: title,
        left: 'left',
        textStyle: {
          color: '#334155',
          fontSize: 12,
          fontWeight: 600,
          fontFamily: 'Inter',
        },
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#FFFFFF',
        borderColor: '#E2E5E9',
        borderWidth: 1,
        extraCssText: 'box-shadow: 0 4px 12px rgba(0,0,0,0.08); border-radius: 8px;',
        textStyle: { color: '#111827', fontFamily: 'JetBrains Mono', fontSize: 11 },
        formatter: (params: any) => {
          if (!Array.isArray(params) || params.length === 0) return '';
          let text = `<div class="font-bold text-amber-800 mb-1">Position: ${Number(params[0].value[0]).toFixed(2)} m</div>`;
          params.forEach((item: any) => {
            text += `<div style="color:${item.color}">${item.seriesName}: <b>${Number(item.value[1]).toFixed(1)} kN</b></div>`;
          });
          return text;
        },
      },
      legend: {
        top: 0,
        right: 0,
        textStyle: { color: '#475569', fontSize: 11 },
        data: ['Surface Card', 'Downhole Pump Card'],
      },
      grid: {
        top: 36,
        left: 48,
        right: 20,
        bottom: 36,
      },
      xAxis: {
        type: 'value',
        name: 'Position (m)',
        nameLocation: 'middle',
        nameGap: 24,
        nameTextStyle: { color: '#475569', fontSize: 11 },
        splitLine: { lineStyle: { color: '#E2E5E9', type: 'dashed' } },
        axisLine: { lineStyle: { color: '#CBD5E1' } },
        axisLabel: { color: '#64748B', fontFamily: 'JetBrains Mono', fontSize: 10 },
      },
      yAxis: {
        type: 'value',
        name: 'Rod Load (kN)',
        nameLocation: 'middle',
        nameGap: 34,
        nameTextStyle: { color: '#475569', fontSize: 11 },
        splitLine: { lineStyle: { color: '#E2E5E9', type: 'dashed' } },
        axisLine: { lineStyle: { color: '#CBD5E1' } },
        axisLabel: { color: '#64748B', fontFamily: 'JetBrains Mono', fontSize: 10 },
      },
      series: [
        {
          name: 'Surface Card',
          type: 'line',
          data: surfaceData,
          showSymbol: false,
          smooth: true,
          lineStyle: { color: '#D97706', width: 2.5 },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(217, 119, 6, 0.16)' },
              { offset: 1, color: 'rgba(217, 119, 6, 0.01)' },
            ]),
          },
        },
        {
          name: 'Downhole Pump Card',
          type: 'line',
          data: downholeData,
          showSymbol: false,
          smooth: true,
          lineStyle: { color: '#0284C7', width: 2, type: 'dashed' },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(2, 132, 199, 0.12)' },
              { offset: 1, color: 'rgba(2, 132, 199, 0.01)' },
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
  }, [dynoCard, title]);

  useEffect(() => {
    return () => {
      chartInstance.current?.dispose();
      chartInstance.current = null;
    };
  }, []);

  const diagnosisStyles: Record<string, { bg: string; text: string; label: string }> = {
    normal: { bg: 'bg-emerald-50 border-emerald-300', text: 'text-emerald-800', label: 'NORMAL OPERATION' },
    rod_floating: { bg: 'bg-rose-50 border-rose-300', text: 'text-rose-800', label: 'ROD FLOATING DETECTED' },
    fluid_pound: { bg: 'bg-amber-50 border-amber-300', text: 'text-amber-900', label: 'FLUID POUND DETECTED' },
    gas_interference: { bg: 'bg-sky-50 border-sky-300', text: 'text-sky-800', label: 'GAS INTERFERENCE' },
    pump_unseating_risk: { bg: 'bg-rose-50 border-rose-300', text: 'text-rose-800', label: 'PUMP UNSEATING RISK' },
    tagging: { bg: 'bg-orange-50 border-orange-300', text: 'text-orange-900', label: 'TAGGING BOTTOM' },
  };

  const diag = dynoCard?.diagnosis ? diagnosisStyles[dynoCard.diagnosis] || {
    bg: 'bg-slate-100 border-slate-300',
    text: 'text-slate-800',
    label: dynoCard.diagnosis.toUpperCase(),
  } : null;

  return (
    <div className="flex flex-col bg-white border border-[#E2E5E9] rounded-xl p-4 shadow-xs">
      {/* Dyno card header / diagnosis banner */}
      <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-100">
        <span className="text-[11px] font-mono font-semibold text-slate-700 uppercase tracking-wider">
          SRP Dyno Card Diagnostics
        </span>
        {diag && (
          <div className={`px-2 py-0.5 rounded border text-[11px] font-mono font-bold flex items-center gap-1.5 ${diag.bg} ${diag.text}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-current" />
            <span>{diag.label}</span>
            {dynoCard?.confidence !== undefined && (
              <span className="text-[10px] text-slate-500 font-normal">
                ({(dynoCard.confidence * 100).toFixed(0)}%)
              </span>
            )}
          </div>
        )}
      </div>

      <div ref={chartRef} style={{ width: '100%', height }} />
    </div>
  );
};
