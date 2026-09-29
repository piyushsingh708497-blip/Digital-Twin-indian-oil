// OIL-TWIN AI - Production KPI Card (Industrial Instrumentation Styling)
import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface KpiCardProps {
  label: string;
  value: string | number | null | undefined;
  unit?: string;
  icon?: LucideIcon;
  subtext?: string;
  trend?: {
    value: string | number;
    direction: 'up' | 'down' | 'neutral';
    isPositiveGood?: boolean;
  };
  highlight?: 'default' | 'accent' | 'warning' | 'critical' | 'healthy';
}

export const KpiCard: React.FC<KpiCardProps> = ({
  label,
  value,
  unit,
  icon: Icon,
  subtext,
  trend,
  highlight = 'default',
}) => {
  const displayVal = value !== null && value !== undefined ? value : '—';

  const cardStyles: Record<string, { border: string; accentLine?: string }> = {
    default: { border: 'border-[#E2E5E9] hover:border-slate-300' },
    accent: { border: 'border-amber-300 hover:border-amber-400', accentLine: 'bg-amber-500' },
    warning: { border: 'border-amber-300 hover:border-amber-400', accentLine: 'bg-amber-500' },
    critical: { border: 'border-rose-300 hover:border-rose-400', accentLine: 'bg-rose-500' },
    healthy: { border: 'border-emerald-300 hover:border-emerald-400', accentLine: 'bg-emerald-500' },
  };

  const style = cardStyles[highlight] || cardStyles.default;

  return (
    <div
      className={`relative bg-white border rounded-xl p-3.5 transition-all duration-150 flex flex-col justify-between shadow-xs ${style.border}`}
    >
      {style.accentLine && (
        <div className={`absolute top-0 left-3 right-3 h-[2px] rounded-t ${style.accentLine} opacity-90`} />
      )}

      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] font-mono font-semibold text-slate-500 uppercase tracking-wider truncate">
          {label}
        </span>
        {Icon && (
          <div className="p-1 rounded bg-slate-50 border border-slate-200 text-slate-500">
            <Icon className="w-3.5 h-3.5" />
          </div>
        )}
      </div>

      <div className="flex items-baseline gap-1 my-0.5">
        <span className="text-xl sm:text-2xl font-mono font-bold text-slate-900 tracking-tight tabular-nums">
          {displayVal}
        </span>
        {unit && (
          <span className="text-xs font-mono font-medium text-slate-500">{unit}</span>
        )}
      </div>

      <div className="mt-1.5 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[11px] font-mono">
        {trend && (
          <span
            className={`flex items-center gap-0.5 font-medium ${
              trend.direction === 'up'
                ? trend.isPositiveGood !== false
                  ? 'text-emerald-700'
                  : 'text-rose-700'
                : trend.direction === 'down'
                ? trend.isPositiveGood !== false
                  ? 'text-rose-700'
                  : 'text-emerald-700'
                : 'text-slate-500'
            }`}
          >
            {trend.direction === 'up' ? '▲' : trend.direction === 'down' ? '▼' : '•'}{' '}
            {trend.value}
          </span>
        )}
        {subtext && <span className="text-slate-500 truncate ml-auto text-[10px]">{subtext}</span>}
      </div>
    </div>
  );
};
