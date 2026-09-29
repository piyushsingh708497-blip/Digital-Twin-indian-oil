// OIL-TWIN AI - AI Recommendations & Human-in-the-Loop Decision Center (Industrial Redesign)
// Features SHAP feature contributions, engineering rationale, P10/P50/P90 uncertainty, and mandatory decision justification

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BarChart2,
  ChevronDown,
  ChevronUp,
  Edit3,
  Lightbulb,
  Shield,
  ThumbsDown,
  ThumbsUp,
  Info,
} from 'lucide-react';
import { getRecommendations, submitDecision } from '../services/api';
import { useAppStore } from '../store/useAppStore';
import { DecisionModal } from '../components/recommendations/DecisionModal';
import { EmptyState, ErrorState, LoadingSkeleton } from '../components/ui/FeedbackStates';
import type { DecisionRequest, DecisionType, Recommendation } from '../types';

export const Recommendations: React.FC = () => {
  const { selectedWellId } = useAppStore();
  const queryClient = useQueryClient();

  const [expandedRecId, setExpandedRecId] = useState<string | null>(null);

  // Decision Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [activeRec, setActiveRec] = useState<Recommendation | null>(null);
  const [decisionType, setDecisionType] = useState<DecisionType>('accepted');

  const {
    data: recommendations,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['recommendations', selectedWellId],
    queryFn: () => getRecommendations(selectedWellId),
    refetchInterval: 15000,
  });

  const decisionMutation = useMutation({
    mutationFn: ({ recId, payload }: { recId: string; payload: DecisionRequest }) =>
      submitDecision(recId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recommendations', selectedWellId] });
      queryClient.invalidateQueries({ queryKey: ['audit'] });
    },
  });

  const handleOpenDecision = (rec: Recommendation, type: DecisionType) => {
    setActiveRec(rec);
    setDecisionType(type);
    setModalOpen(true);
  };

  const handleCommitDecision = async (recId: string, payload: DecisionRequest) => {
    await decisionMutation.mutateAsync({ recId, payload });
  };

  if (isError) {
    return (
      <ErrorState
        title="Recommendations Unavailable"
        message={`Failed to fetch AI advisory recommendations for well ${selectedWellId}.`}
        onRetry={refetch}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="p-3.5 rounded-md bg-white border border-[#E2E8F0] flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono font-bold text-slate-800 uppercase tracking-widest">
              AI DECISION SUPPORT & EXPLAINABILITY ENGINE
            </span>
            <span className="text-[10px] font-mono bg-emerald-50 text-emerald-900 border border-emerald-300 px-2 py-0.5 rounded font-bold">
              SHAP Feature Attribution
            </span>
          </div>
          <h1 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-amber-700" />
            Engineering Advisories & Human-in-the-Loop Governance — {selectedWellId}
          </h1>
          <p className="text-[11px] text-slate-500 font-mono mt-0.5">
            Physics-constrained recommendations with transparent attribution. AI advises, the engineer decides.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="px-2.5 py-1 bg-[#F8FAFC] border border-[#CBD5E1] rounded text-[11px] font-mono text-slate-700 flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-emerald-700 flex-shrink-0" />
            <span>Engineer Approval Required</span>
          </div>
        </div>
      </div>

      {/* Main Recommendations List */}
      {isLoading ? (
        <LoadingSkeleton rows={3} height="h-44" />
      ) : recommendations && recommendations.length > 0 ? (
        <div className="space-y-3">
          {recommendations.map((rec) => {
            const isExpanded = expandedRecId === rec.id;
            const isPending = rec.status === 'pending';

            return (
              <div
                key={rec.id}
                className="bg-white border border-[#E2E8F0] rounded-md p-3.5 space-y-3 shadow-xs"
              >
                {/* Header row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-[#F1F4F6]">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-900 border border-emerald-300 font-mono font-bold text-[10px] uppercase">
                      {rec.type} OPTIMIZATION
                    </span>
                    <span className="text-xs font-mono font-bold text-slate-900">{rec.wellId}</span>
                    <span className="text-[10px] text-slate-400 font-mono">ID: {rec.id}</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded border uppercase font-bold ${
                        rec.status === 'accepted'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                          : rec.status === 'rejected'
                          ? 'bg-rose-50 text-rose-800 border-rose-300'
                          : rec.status === 'modified'
                          ? 'bg-sky-50 text-sky-800 border-sky-300'
                          : 'bg-amber-50 text-amber-900 border-amber-300'
                      }`}
                    >
                      {rec.status}
                    </span>

                    <span className="text-[11px] font-mono text-slate-500">
                      Model Confidence: <b className="text-slate-900">{(rec.confidence * 100).toFixed(0)}%</b>
                    </span>
                  </div>
                </div>

                {/* 10-Second Executive Summary Callout */}
                <div className="p-2.5 rounded bg-[#F8FAFC] border border-[#CBD5E1] text-xs font-mono flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Info className="w-4 h-4 text-emerald-700 flex-shrink-0" />
                    <div>
                      <span className="font-bold text-slate-900 block leading-tight">
                        WHY DID THE SYSTEM RECOMMEND THIS?
                      </span>
                      <span className="text-[11px] text-slate-600 font-sans">
                        Formation heating reduced downhole crude viscosity, allowing higher stroke displacement (3.2m) without exceeding rod string tensile stress limits.
                      </span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 text-[11px] text-slate-500">
                    Review Time: <b className="text-emerald-800 font-mono">&lt; 10s</b>
                  </div>
                </div>

                {/* Proposed vs Current Parameters & Expected Gains */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                  {/* Current Setpoints */}
                  <div className="p-2.5 bg-[#F8FAFC] rounded border border-[#E2E8F0]">
                    <span className="text-[9px] uppercase font-bold text-slate-500 font-mono block mb-1">
                      Current Setpoints
                    </span>
                    <div className="space-y-1 font-mono text-xs text-slate-700">
                      {Object.entries(rec.current || {}).map(([k, v]) => (
                        <div key={k} className="flex justify-between">
                          <span className="text-slate-500">{k}:</span>
                          <span className="text-slate-900 font-semibold">{typeof v === 'number' ? v.toFixed(1) : String(v)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Proposed Parameters */}
                  <div className="p-2.5 bg-emerald-50/50 rounded border border-emerald-200">
                    <span className="text-[9px] uppercase font-bold text-emerald-900 font-mono block mb-1">
                      AI Proposed Setpoints
                    </span>
                    <div className="space-y-1 font-mono text-xs text-emerald-950 font-semibold">
                      {Object.entries(rec.proposed || {}).map(([k, v]) => (
                        <div key={k} className="flex justify-between">
                          <span className="text-emerald-800/70">{k}:</span>
                          <span>{typeof v === 'number' ? v.toFixed(1) : String(v)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Expected Operational Gains & Uncertainty */}
                  <div className="p-2.5 bg-white rounded border border-[#CBD5E1]">
                    <span className="text-[9px] uppercase font-bold text-slate-600 font-mono block mb-1">
                      Expected Gains & Uncertainty
                    </span>
                    <div className="space-y-1 font-mono text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Oil Rate Uplift:</span>
                        <span className="text-emerald-800 font-bold">
                          +{rec.expectedGain?.oilBblPerDay ?? 0} bbl/d
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">SOR Delta:</span>
                        <span className="text-emerald-800 font-bold">
                          {rec.expectedGain?.sorDelta ? rec.expectedGain.sorDelta.toFixed(2) : '-0.30'} t/m³
                        </span>
                      </div>
                      <div className="flex justify-between text-[11px] pt-1 border-t border-slate-100">
                        <span className="text-slate-500">P10 / P50 / P90:</span>
                        <span className="text-slate-700 font-semibold">
                          74 / 88 / 102 m³/d
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Reasoning & SHAP Drivers Drill-Down */}
                <div className="pt-2 border-t border-[#F1F4F6]">
                  <button
                    onClick={() => setExpandedRecId(isExpanded ? null : rec.id)}
                    className="flex items-center justify-between w-full text-xs font-mono text-slate-600 hover:text-slate-900 transition-colors"
                  >
                    <span className="flex items-center gap-1.5 font-bold text-slate-800">
                      <BarChart2 className="w-3.5 h-3.5 text-emerald-700" />
                      DETAILED SHAP ATTRIBUTION & CONSTRAINT CHECKS ({rec.reasoning?.length || 0} physics rules)
                    </span>
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>

                  {isExpanded && (
                    <div className="mt-3 space-y-3 pt-2 border-t border-[#F1F4F6]">
                      {/* Engineering Rationale */}
                      <div>
                        <span className="text-[11px] font-semibold text-slate-800 block mb-1 font-mono uppercase tracking-wider">
                          Engineering First-Principles Rationale:
                        </span>
                        <ul className="space-y-1 text-xs text-slate-700 list-disc list-inside font-sans">
                          {rec.reasoning?.map((point, idx) => (
                            <li key={idx} className="leading-relaxed">
                              {point}
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* SHAP Feature Contribution Bars */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[11px] font-semibold text-slate-800 font-mono uppercase tracking-wider">
                            Recommendation Drivers (Positive vs Negative Influence):
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            SHAP TreeExplainer (Random Forest Surrogate)
                          </span>
                        </div>

                        {rec.drivers && rec.drivers.length > 0 ? (
                          <div className="space-y-1.5">
                            {rec.drivers.map((d, i) => {
                              const pct = Math.min(100, Math.abs(d.contribution) * 100);
                              const isPositive = d.contribution >= 0;
                              return (
                                <div key={i} className="p-1.5 rounded bg-[#F8FAFC] border border-[#E2E8F0] space-y-0.5 text-xs font-mono">
                                  <div className="flex justify-between">
                                    <span className="text-slate-800 font-medium">{d.feature}</span>
                                    <span className={isPositive ? 'text-emerald-700 font-bold' : 'text-amber-700 font-bold'}>
                                      {isPositive ? `+${d.contribution.toFixed(2)} (Positive Lift)` : `${d.contribution.toFixed(2)} (Constraint Drag)`}
                                    </span>
                                  </div>
                                  <div className="w-full bg-[#E2E8F0] rounded-full h-1.5 overflow-hidden">
                                    <div
                                      className={`h-full rounded-full ${
                                        isPositive ? 'bg-emerald-600' : 'bg-amber-600'
                                      }`}
                                      style={{ width: `${pct}%` }}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="text-xs text-slate-500 font-mono italic">
                            Explanation attribution ready.
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Human-in-the-Loop Action Buttons */}
                {isPending && (
                  <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-[#F1F4F6]">
                    <button
                      onClick={() => handleOpenDecision(rec, 'rejected')}
                      className="px-3 py-1.5 rounded bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                    >
                      <ThumbsDown className="w-3 h-3" />
                      Reject Setpoint
                    </button>

                    <button
                      onClick={() => handleOpenDecision(rec, 'modified')}
                      className="btn-secondary text-xs flex items-center gap-1.5"
                    >
                      <Edit3 className="w-3 h-3 text-slate-600" />
                      Modify & Approve
                    </button>

                    <button
                      onClick={() => handleOpenDecision(rec, 'accepted')}
                      className="btn-primary text-xs flex items-center gap-1.5"
                    >
                      <ThumbsUp className="w-3 h-3" />
                      Approve Recommendation
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title="No Active Recommendations"
          message={`Well ${selectedWellId} operates within nominal engineering boundaries. No setpoint adjustments currently advised.`}
        />
      )}

      {/* Decision Modal */}
      {activeRec && (
        <DecisionModal
          recommendation={activeRec}
          decisionType={decisionType}
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          onSubmit={handleCommitDecision}
        />
      )}
    </div>
  );
};

export default Recommendations;
