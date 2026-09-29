// OIL-TWIN AI - Operational Alert Center
// Real-time alert feed with severity filtering and operator acknowledgement
import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Bell,
  Check,
  Clock,
  Filter,
} from 'lucide-react';
import { acknowledgeAlert, getAlerts } from '../services/api';
import { StatusBadge } from '../components/ui/StatusBadge';
import { EmptyState, ErrorState, LoadingSkeleton } from '../components/ui/FeedbackStates';

export const Alerts: React.FC = () => {
  const queryClient = useQueryClient();
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [onlyUnack, setOnlyUnack] = useState<boolean>(false);

  const {
    data: alerts,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['alerts'],
    queryFn: () => getAlerts(),
    refetchInterval: 10000,
  });

  const ackMutation = useMutation({
    mutationFn: (id: string) => acknowledgeAlert(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    },
  });

  if (isError) {
    return (
      <ErrorState
        title="Failed to Load Alerts"
        message="Unable to fetch active alerts from the central notification bus."
        onRetry={refetch}
      />
    );
  }

  const filtered = (alerts || []).filter((a) => {
    const matchesSev = filterSeverity === 'all' || a.severity.toLowerCase() === filterSeverity;
    const matchesUnack = !onlyUnack || !a.acknowledged;
    return matchesSev && matchesUnack;
  });

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="p-4 rounded-xl bg-white border border-[#E2E5E9] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono font-bold text-amber-700 uppercase tracking-widest">
              EARLY WARNING SYSTEM
            </span>
            <span className="text-[10px] font-mono bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded-md font-medium">
              Predictive Failure Detection
            </span>
          </div>
          <h1 className="text-lg font-bold text-slate-900 tracking-wide flex items-center gap-2">
            <Bell className="w-5 h-5 text-amber-600" />
            Field Operational Alert Center
          </h1>
          <p className="text-xs text-slate-500 font-mono mt-0.5">
            Machine learning failure precursors: Rod floating, impact loading, pump unseating, and sensor staleness
          </p>
        </div>

        {/* Severity & Unack Filter Tabs */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 bg-[#F1F3F5] border border-[#E2E5E9] rounded-lg p-0.5">
            <Filter className="w-3 h-3 text-slate-500 ml-1 mr-0.5" />
            {['all', 'critical', 'warn', 'info'].map((sev) => (
              <button
                key={sev}
                onClick={() => setFilterSeverity(sev)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-mono transition-colors ${
                  filterSeverity === sev
                    ? 'bg-amber-600 text-white font-bold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {sev.toUpperCase()}
              </button>
            ))}
          </div>

          <button
            onClick={() => setOnlyUnack(!onlyUnack)}
            className={`px-3 py-1.5 rounded-lg border text-xs font-mono transition-colors flex items-center gap-1.5 shadow-xs ${
              onlyUnack
                ? 'bg-red-50 border-red-300 text-red-700 font-bold'
                : 'bg-white border-[#E2E5E9] text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${onlyUnack ? 'bg-red-600 animate-pulse' : 'bg-slate-400'}`} />
            Unacknowledged Only
          </button>
        </div>
      </div>

      {/* Alerts Feed */}
      {isLoading ? (
        <LoadingSkeleton rows={4} height="h-28" />
      ) : filtered.length > 0 ? (
        <div className="space-y-3">
          {filtered.map((alert) => (
            <div
              key={alert.id}
              className={`p-4 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs ${
                alert.acknowledged
                  ? 'bg-slate-50 border-slate-200 opacity-75'
                  : alert.severity === 'critical'
                  ? 'bg-red-50/70 border-red-200'
                  : alert.severity === 'warn'
                  ? 'bg-amber-50/70 border-amber-200'
                  : 'bg-blue-50/60 border-blue-200'
              }`}
            >
              <div className="space-y-1.5 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge type="severity" value={alert.severity} />
                  <span className="font-mono text-xs font-bold text-amber-800">
                    {alert.wellId}
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-white text-slate-700 border border-[#E2E5E9] shadow-xs">
                    {alert.kind}
                  </span>
                  {alert.probability !== undefined && (
                    <span className="text-xs font-mono text-slate-600">
                      Probability: <b className="text-slate-900">{(alert.probability * 100).toFixed(0)}%</b>
                    </span>
                  )}
                  {alert.timeToEventHrs && (
                    <span className="text-[11px] font-mono text-red-700 bg-red-100 border border-red-200 px-2 py-0.5 rounded-md flex items-center gap-1 font-medium">
                      <Clock className="w-3 h-3" />
                      TTE: {alert.timeToEventHrs} hrs
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-800 font-sans leading-relaxed font-normal">
                  {alert.message}
                </p>

                <div className="text-[10px] font-mono text-slate-500">
                  Created: {alert.createdAt || 'Just now'}
                </div>
              </div>

              {/* Action Area */}
              <div className="flex items-center gap-3">
                {alert.acknowledged ? (
                  <span className="text-xs font-mono text-emerald-800 flex items-center gap-1 px-3 py-1 bg-emerald-50 border border-emerald-200 rounded-md font-medium">
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    Acknowledged
                  </span>
                ) : (
                  <button
                    onClick={() => ackMutation.mutate(alert.id)}
                    disabled={ackMutation.isPending}
                    className="btn-secondary text-xs flex items-center gap-1.5 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300"
                  >
                    <Check className="w-3.5 h-3.5" />
                    {ackMutation.isPending ? 'Acknowledging...' : 'Acknowledge'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No Alerts Match Filters"
          message="All monitored wells are reporting normal parameters within the selected severity filter."
        />
      )}
    </div>
  );
};

export default Alerts;
