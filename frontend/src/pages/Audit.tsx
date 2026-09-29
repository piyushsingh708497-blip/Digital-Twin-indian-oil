// OIL-TWIN AI - Immutable Audit Trail Page
// Append-only cryptographic ledger of human-in-the-loop decisions and system events
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  History,
  Lock,
  RefreshCw,
  Search,
  Shield,
  User,
} from 'lucide-react';
import { getAuditTrail } from '../services/api';
import { useAppStore } from '../store/useAppStore';
import { EmptyState, ErrorState, LoadingSkeleton } from '../components/ui/FeedbackStates';

export const Audit: React.FC = () => {
  const { selectedWellId } = useAppStore();
  const [filterWellOnly, setFilterWellOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const {
    data: auditRecords,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['audit', filterWellOnly ? selectedWellId : 'all'],
    queryFn: () => getAuditTrail(filterWellOnly ? { wellId: selectedWellId } : {}),
    refetchInterval: 15000,
  });

  if (isError) {
    return (
      <ErrorState
        title="Audit Trail Offline"
        message="Unable to retrieve immutable decision records from the audit ledger."
        onRetry={refetch}
      />
    );
  }

  const filtered = (auditRecords || []).filter((r) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const eventMatch = r.eventType?.toLowerCase().includes(q);
    const wellMatch = r.wellId?.toLowerCase().includes(q);
    const reasonMatch = r.details?.reason?.toLowerCase().includes(q);
    const userMatch = r.details?.decidedBy?.toLowerCase().includes(q);
    return eventMatch || wellMatch || reasonMatch || userMatch;
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="p-4 rounded-xl bg-white border border-[#E2E5E9] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono font-bold text-amber-700 uppercase tracking-widest">
              COMPLIANCE & GOVERNANCE
            </span>
            <span className="text-[10px] font-mono bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-md flex items-center gap-1 font-medium">
              <Lock className="w-3 h-3 text-emerald-600" />
              Append-Only Ledger
            </span>
          </div>
          <h1 className="text-lg font-bold text-slate-900 tracking-wide flex items-center gap-2">
            <History className="w-5 h-5 text-amber-600" />
            Decision Audit Trail & Operational Timeline
          </h1>
          <p className="text-xs text-slate-500 font-mono mt-0.5">
            Tamper-evident record of all operator approvals, rejections, parameter overrides, and supervisory events
          </p>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search reason or operator..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-white border border-[#E2E5E9] rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 font-mono shadow-xs"
            />
          </div>

          <button
            onClick={() => setFilterWellOnly(!filterWellOnly)}
            className={`px-3 py-1.5 rounded-lg border text-xs font-mono transition-colors shadow-xs ${
              filterWellOnly
                ? 'bg-amber-600 text-white font-bold border-amber-600'
                : 'bg-white border-[#E2E5E9] text-slate-700 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            {filterWellOnly ? `Only ${selectedWellId}` : 'All Wells'}
          </button>

          <button onClick={() => refetch()} className="btn-secondary text-xs">
            <RefreshCw className="w-3.5 h-3.5 text-slate-600" />
          </button>
        </div>
      </div>

      {/* Immutable Timeline Feed */}
      {isLoading ? (
        <LoadingSkeleton rows={4} height="h-28" />
      ) : filtered.length > 0 ? (
        <div className="space-y-3 relative before:absolute before:inset-0 before:left-5 before:w-0.5 before:bg-[#E2E5E9] before:-z-0">
          {filtered.map((record) => {
            const details = record.details || {};
            const decision = details.decision;

            return (
              <div
                key={record.id}
                className="relative bg-white border border-[#E2E5E9] rounded-xl p-4 ml-3 sm:ml-6 space-y-3 hover:border-slate-300 transition-colors shadow-xs"
              >
                {/* Event Header */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-[#E2E5E9]">
                  <div className="flex items-center gap-2">
                    <span className="p-1 rounded-md bg-[#F1F3F5] text-amber-700 border border-[#E2E5E9]">
                      <Shield className="w-3.5 h-3.5 text-amber-600" />
                    </span>
                    <span className="font-mono text-xs font-bold text-slate-900 uppercase">
                      {record.eventType}
                    </span>
                    {record.wellId && (
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 font-bold">
                        {record.wellId}
                      </span>
                    )}
                    {decision && (
                      <span
                        className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-md border ${
                          decision === 'accepted'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : decision === 'rejected'
                            ? 'bg-red-50 text-red-800 border-red-200'
                            : 'bg-blue-50 text-blue-800 border-blue-200'
                        }`}
                      >
                        {decision}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 font-mono text-[11px] text-slate-500">
                    <span>{record.createdAt || 'Record Logged'}</span>
                    <span className="text-slate-300">•</span>
                    <span className="text-slate-400">HASH #{record.id.slice(0, 8)}</span>
                  </div>
                </div>

                {/* Details / Justification */}
                <div className="space-y-2 text-xs">
                  {details.reason && (
                    <div className="p-3 rounded-lg bg-[#F8F9FA] border border-[#E2E5E9]">
                      <span className="text-[10px] uppercase font-bold text-slate-500 font-mono block mb-1">
                        Mandatory Engineering Rationale:
                      </span>
                      <p className="text-slate-800 font-sans italic">"{details.reason}"</p>
                    </div>
                  )}

                  {/* Modified setpoints if any */}
                  {details.modifiedValues && (
                    <div className="p-2.5 rounded-lg bg-[#FAF6EE] border border-amber-200 text-[11px] font-mono text-amber-900">
                      <span className="text-amber-800 font-semibold block mb-0.5">Overridden Parameters:</span>
                      <code>{JSON.stringify(details.modifiedValues)}</code>
                    </div>
                  )}

                  {/* Decided By Operator */}
                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 pt-1">
                    <span className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      Signatory: <b className="text-slate-800 font-semibold">{details.decidedBy || 'System Autonomous'}</b>
                    </span>
                    {details.recommendationId && (
                      <span className="text-slate-400 truncate">Target Ref: {details.recommendationId}</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title="Audit Ledger Empty"
          message="No operational decisions or system overrides recorded yet."
        />
      )}
    </div>
  );
};

export default Audit;
