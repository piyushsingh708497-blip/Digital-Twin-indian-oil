// OIL-TWIN AI - Status & Severity Badges
import React from 'react';
import type { AlertSeverity, CssCyclePhase, OverallQuality, TagQualityStatus } from '../../types';

interface StatusBadgeProps {
  type: 'phase' | 'severity' | 'quality' | 'tag' | 'connection';
  value: string;
  label?: string;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ type, value, label, size = 'sm' }) => {
  const text = label || value;
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs';

  if (type === 'phase') {
    const phase = value.toLowerCase() as CssCyclePhase;
    const styles: Record<CssCyclePhase, string> = {
      production: 'bg-emerald-50 text-emerald-800 border-emerald-300',
      injection: 'bg-sky-50 text-sky-800 border-sky-300',
      soak: 'bg-amber-50 text-amber-800 border-amber-300',
      idle: 'bg-slate-100 text-slate-700 border-slate-300',
    };
    return (
      <span className={`inline-flex items-center gap-1.5 font-mono font-medium rounded border ${styles[phase] || styles.idle} ${sizeClasses}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${phase === 'production' ? 'bg-emerald-500' : phase === 'injection' ? 'bg-sky-500' : phase === 'soak' ? 'bg-amber-500' : 'bg-slate-400'}`} />
        {text.toUpperCase()}
      </span>
    );
  }

  if (type === 'severity') {
    const sev = value.toLowerCase() as AlertSeverity;
    const styles: Record<AlertSeverity, string> = {
      critical: 'bg-rose-50 text-rose-800 border-rose-300',
      warn: 'bg-amber-50 text-amber-900 border-amber-300',
      info: 'bg-sky-50 text-sky-800 border-sky-300',
    };
    return (
      <span className={`inline-flex items-center gap-1.5 font-mono font-semibold rounded border ${styles[sev] || styles.info} ${sizeClasses}`}>
        {sev === 'critical' ? (
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
        ) : (
          <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
        )}
        {text.toUpperCase()}
      </span>
    );
  }

  if (type === 'quality') {
    const q = value.toLowerCase() as OverallQuality;
    const styles: Record<OverallQuality, string> = {
      good: 'bg-emerald-50 text-emerald-800 border-emerald-300',
      degraded: 'bg-amber-50 text-amber-900 border-amber-300',
      critical: 'bg-rose-50 text-rose-800 border-rose-300',
    };
    return (
      <span className={`inline-flex items-center gap-1.5 font-mono font-medium rounded border ${styles[q] || styles.degraded} ${sizeClasses}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${q === 'good' ? 'bg-emerald-500' : q === 'degraded' ? 'bg-amber-500' : 'bg-rose-500'}`} />
        {text.toUpperCase()}
      </span>
    );
  }

  if (type === 'tag') {
    const tag = value.toLowerCase() as TagQualityStatus;
    const styles: Record<TagQualityStatus, string> = {
      ok: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      stale: 'bg-amber-50 text-amber-900 border-amber-200',
      bad: 'bg-rose-50 text-rose-800 border-rose-200',
      missing: 'bg-slate-100 text-slate-600 border-slate-200',
    };
    return (
      <span className={`inline-flex items-center font-mono font-medium rounded border ${styles[tag] || styles.missing} px-1.5 py-0.5 text-[10px]`}>
        {text.toUpperCase()}
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center font-mono font-medium rounded bg-slate-100 text-slate-700 border border-slate-300 ${sizeClasses}`}>
      {text}
    </span>
  );
};
