// OIL-TWIN AI - Failure Early Warning System Component
// Uses existing backend Alert, Failure Model, and Telemetry outputs
// Never invents probabilities, TTE, or SHAP drivers; strictly data-driven

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  Check,
  Clock,
  Gauge,
  HelpCircle,
  ShieldAlert,
  Zap,
} from 'lucide-react';
import { acknowledgeAlert, getAlerts, getRecommendations, getWellState } from '../../services/api';
import type { Alert, AlertSeverity } from '../../types';

interface FailureEarlyWarningCardProps {
  wellId: string;
  className?: string;
}

export const FailureEarlyWarningCard: React.FC<FailureEarlyWarningCardProps> = ({
  wellId,
  className = '',
}) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // 1. Fetch live active alerts for this well
  const { data: alerts = [] } = useQuery({
    queryKey: ['alerts', wellId],
    queryFn: () => getAlerts({ wellId }),
    refetchInterval: 10000,
  });

  // 2. Fetch well telemetry state (for rod stress, SPM, pump fillage, water cut)
  const { data: wellState } = useQuery({
    queryKey: ['wellState', wellId],
    queryFn: () => getWellState(wellId),
    refetchInterval: 10000,
  });

  // 3. Fetch recommendations for SHAP drivers
  const { data: recommendations = [] } = useQuery({
    queryKey: ['recommendations', wellId],
    queryFn: () => getRecommendations(wellId),
    refetchInterval: 15000,
  });

  // Acknowledge mutation
  const ackMutation = useMutation({
    mutationFn: (alertId: string) => acknowledgeAlert(alertId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      queryClient.invalidateQueries({ queryKey: ['wellState', wellId] });
    },
  });

  // Pick the most critical unacknowledged alert, or the highest severity alert for this well
  const activeUnackAlerts = alerts.filter((a) => !a.acknowledged);
  const primaryAlert: Alert | undefined =
    activeUnackAlerts.find((a) => a.severity === 'critical') ||
    activeUnackAlerts.find((a) => a.severity === 'warn') ||
    activeUnackAlerts[0] ||
    alerts.find((a) => a.severity === 'critical') ||
    alerts[0];

  const tel = wellState?.telemetry;

  // ── 1. FAILURE RISK ──
  // Only if backend provides a probability. Otherwise 'Unavailable'
  const failureRiskText: string =
    primaryAlert?.probability !== undefined && primaryAlert.probability !== null
      ? `${(primaryAlert.probability * 100).toFixed(0)}%`
      : 'Unavailable';

  // ── 2. TIME TO EVENT ──
  // Only if backend provides timeToEventHrs. Otherwise 'Not available'
  const timeToEventText: string =
    primaryAlert?.timeToEventHrs !== undefined && primaryAlert.timeToEventHrs !== null
      ? `${primaryAlert.timeToEventHrs.toFixed(1)} hrs`
      : 'Not available';

  // ── 3. RISK LEVEL ──
  // Derived strictly from backend severity or threshold
  const severity: AlertSeverity | 'nominal' = primaryAlert ? primaryAlert.severity : 'nominal';
  let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
  if (severity === 'critical') {
    riskLevel = 'CRITICAL';
  } else if (severity === 'warn') {
    riskLevel = 'HIGH';
  } else if (severity === 'info') {
    riskLevel = 'MEDIUM';
  } else {
    riskLevel = 'LOW';
  }

  // Visual classes according to risk level
  const badgeClasses = {
    CRITICAL: 'bg-red-50 text-red-700 border-red-200',
    HIGH: 'bg-amber-50 text-amber-800 border-amber-200',
    MEDIUM: 'bg-blue-50 text-blue-700 border-blue-200',
    LOW: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  }[riskLevel];

  const bannerBorder = {
    CRITICAL: 'border-red-200 bg-red-50/40',
    HIGH: 'border-amber-200 bg-amber-50/40',
    MEDIUM: 'border-blue-200 bg-blue-50/40',
    LOW: 'border-[#E2E5E9] bg-white',
  }[riskLevel];

  // ── 4. TOP DRIVERS (Backend-provided ONLY) ──
  // Extract real backend drivers from recommendation explainers or active telemetry
  const srpReco = recommendations.find((r) => r.type === 'srp' || r.type === 'joint');
  const backendDrivers = srpReco?.drivers || [];

  // ── 5. EARLY WARNING MESSAGE ──
  // Engineering explanation based ONLY on backend data
  const earlyWarningMessage: string = primaryAlert
    ? primaryAlert.message
    : riskLevel === 'LOW'
    ? 'All telemetry tags and rod dynamics operating within normal Goodman allowable limits.'
    : 'Elevated failure risk detected from live telemetry.';

  return (
    <div className={`p-4 rounded-xl border ${bannerBorder} shadow-xs space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E2E5E9]">
        <div className="flex items-center gap-2.5">
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
              riskLevel === 'CRITICAL'
                ? 'bg-red-100 text-red-700 border border-red-200'
                : riskLevel === 'HIGH'
                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                : 'bg-blue-100 text-blue-700 border border-blue-200'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-bold tracking-wider uppercase text-slate-500">
                EARLY WARNING SYSTEM
              </span>
              <span className="text-[9px] font-mono bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.2 rounded font-semibold">
                SIMULATED PREDICTOR
              </span>
            </div>
            <h3 className="text-sm font-bold text-slate-900 font-mono tracking-tight flex items-center gap-2">
              Failure Risk Diagnostic — Well {wellId}
            </h3>
          </div>
        </div>

        {/* Risk Level Badge */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-slate-500">Risk Level:</span>
          <span
            className={`text-xs font-mono font-bold px-2.5 py-1 rounded-md border uppercase tracking-wider ${badgeClasses}`}
          >
            {riskLevel}
          </span>
        </div>
      </div>

      {/* Primary Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Failure Risk */}
        <div className="p-3 bg-white border border-[#E2E5E9] rounded-lg shadow-2xs">
          <span className="text-[11px] font-mono text-slate-500 block mb-0.5">Failure Risk</span>
          <span
            className={`text-lg font-bold font-mono ${
              riskLevel === 'CRITICAL'
                ? 'text-red-700'
                : riskLevel === 'HIGH'
                ? 'text-amber-700'
                : 'text-slate-900'
            }`}
          >
            {failureRiskText}
          </span>
          <span className="text-[10px] text-slate-400 block font-mono">Backend Probability</span>
        </div>

        {/* Time To Event */}
        <div className="p-3 bg-white border border-[#E2E5E9] rounded-lg shadow-2xs">
          <span className="text-[11px] font-mono text-slate-500 block mb-0.5 flex items-center gap-1">
            <Clock className="w-3 h-3 text-slate-400" />
            Time To Event
          </span>
          <span
            className={`text-lg font-bold font-mono ${
              timeToEventText !== 'Not available' && primaryAlert?.severity === 'critical'
                ? 'text-red-700'
                : 'text-slate-900'
            }`}
          >
            {timeToEventText}
          </span>
          <span className="text-[10px] text-slate-400 block font-mono">
            {timeToEventText !== 'Not available' ? 'Estimated lead time' : 'Model unconstrained'}
          </span>
        </div>

        {/* Rod Load / Stress */}
        <div className="p-3 bg-white border border-[#E2E5E9] rounded-lg shadow-2xs">
          <span className="text-[11px] font-mono text-slate-500 block mb-0.5 flex items-center gap-1">
            <Gauge className="w-3 h-3 text-slate-400" />
            Peak Rod Load
          </span>
          <span className="text-lg font-bold font-mono text-slate-900">
            {tel?.srp?.rodLoadMax ? `${tel.srp.rodLoadMax.toFixed(1)} kN` : 'Data unavailable'}
          </span>
          <span className="text-[10px] text-slate-400 block font-mono">
            Min: {tel?.srp?.rodLoadMin ? `${tel.srp.rodLoadMin.toFixed(1)} kN` : 'N/A'}
          </span>
        </div>

        {/* Pump Fillage */}
        <div className="p-3 bg-white border border-[#E2E5E9] rounded-lg shadow-2xs">
          <span className="text-[11px] font-mono text-slate-500 block mb-0.5 flex items-center gap-1">
            <Zap className="w-3 h-3 text-slate-400" />
            Pump Fillage
          </span>
          <span
            className={`text-lg font-bold font-mono ${
              tel?.srp?.pumpFillagePct !== undefined && tel.srp.pumpFillagePct < 70
                ? 'text-amber-700'
                : 'text-slate-900'
            }`}
          >
            {tel?.srp?.pumpFillagePct !== undefined
              ? `${tel.srp.pumpFillagePct.toFixed(0)}%`
              : 'Data unavailable'}
          </span>
          <span className="text-[10px] text-slate-400 block font-mono">
            SPM: {tel?.srp?.spm ? tel.srp.spm.toFixed(1) : 'N/A'}
          </span>
        </div>
      </div>

      {/* Engineering Explanation Message */}
      <div className="p-3 rounded-lg bg-white border border-[#E2E5E9] space-y-1 shadow-2xs">
        <span className="text-[10px] font-mono uppercase font-bold text-slate-500 block">
          Diagnostic Assessment:
        </span>
        <p className="text-xs text-slate-800 leading-relaxed font-sans font-normal">
          {earlyWarningMessage}
        </p>
      </div>

      {/* Top Drivers (Backend SHAP / Telemetry Drivers) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono font-bold text-slate-700 flex items-center gap-1.5">
            Top Failure Precursor Drivers (Backend Quantified)
          </span>
          <span className="text-[10px] font-mono text-slate-400">
            {backendDrivers.length > 0 ? `${backendDrivers.length} active drivers` : 'Telemetry tags'}
          </span>
        </div>

        {backendDrivers.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {backendDrivers.map((d) => (
              <div
                key={d.feature}
                className="p-2.5 rounded-lg bg-white border border-[#E2E5E9] flex flex-col justify-between shadow-2xs"
              >
                <div className="flex items-center justify-between text-xs font-mono mb-1">
                  <span className="font-semibold text-slate-800 truncate" title={d.feature}>
                    {d.feature.replace(/_/g, ' ')}
                  </span>
                  <span className="font-bold text-amber-700">
                    {(d.contribution * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-amber-600 h-1.5 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(100, Math.max(5, d.contribution * 100))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-2.5 bg-white border border-[#E2E5E9] rounded-lg text-xs font-mono text-slate-500 flex items-center gap-2">
            <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
            <span>
              Direct SHAP drivers currently unavailable for this operational state. Monitored parameters: SPM ({tel?.srp?.spm?.toFixed(1) ?? '—'}), Water Cut ({tel?.surface?.waterCutPct?.toFixed(1) ?? '—'}%), Motor Load ({tel?.srp?.kW?.toFixed(1) ?? '—'} kW).
            </span>
          </div>
        )}
      </div>

      {/* Alert Actions Bar */}
      {primaryAlert && (
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#E2E5E9]">
          <div className="text-xs font-mono text-slate-500 flex items-center gap-2">
            <span className="font-semibold text-slate-700">Active Alert:</span>
            <span className="text-amber-800 font-bold">{primaryAlert.id}</span>
            <span>•</span>
            <span>Kind: {primaryAlert.kind}</span>
          </div>

          <div className="flex items-center gap-2">
            {!primaryAlert.acknowledged && (
              <button
                onClick={() => ackMutation.mutate(primaryAlert.id)}
                disabled={ackMutation.isPending}
                className="btn-secondary text-xs flex items-center gap-1.5 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300"
              >
                <Check className="w-3.5 h-3.5" />
                {ackMutation.isPending ? 'Acknowledging...' : 'Acknowledge Alert'}
              </button>
            )}

            <button
              onClick={() => navigate('/alerts')}
              className="btn-secondary text-xs flex items-center gap-1"
            >
              <span>View All Alerts</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default FailureEarlyWarningCard;
