// OIL-TWIN AI - Human-in-the-Loop Recommendation Decision Modal
// Mandatory Engineering Rationale required before submission
import React, { useState } from 'react';
import { AlertCircle, Check, X, Sliders, Shield } from 'lucide-react';
import type { DecisionRequest, DecisionType, Recommendation } from '../../types';

interface DecisionModalProps {
  recommendation: Recommendation;
  decisionType: DecisionType;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (recId: string, payload: DecisionRequest) => Promise<void>;
}

export const DecisionModal: React.FC<DecisionModalProps> = ({
  recommendation,
  decisionType,
  isOpen,
  onClose,
  onSubmit,
}) => {
  const [reason, setReason] = useState('');
  const [decidedBy, setDecidedBy] = useState('Senior Production Engineer');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modifiedJson, setModifiedJson] = useState(
    JSON.stringify(recommendation.proposed || {}, null, 2)
  );
  const [jsonError, setJsonError] = useState<string | null>(null);

  if (!isOpen) return null;

  const isModify = decisionType === 'modified';
  const isReasonValid = reason.trim().length >= 3;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isReasonValid) return;

    let parsedModifiedValues: Record<string, any> | null = null;
    if (isModify) {
      try {
        parsedModifiedValues = JSON.parse(modifiedJson);
        setJsonError(null);
      } catch (err) {
        setJsonError('Invalid JSON format for modified parameters');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      await onSubmit(recommendation.id, {
        decision: decisionType,
        reason: reason.trim(),
        decidedBy: decidedBy.trim() || 'Petroleum Engineer',
        modifiedValues: parsedModifiedValues,
      });
      onClose();
    } catch (err) {
      console.error('Failed to submit decision:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const titles: Record<DecisionType, { title: string; badge: string; color: string }> = {
    accepted: {
      title: 'Approve & Implement Recommendation',
      badge: 'APPROVAL CONFIRMATION',
      color: 'bg-emerald-500 hover:bg-emerald-400 text-slate-950',
    },
    rejected: {
      title: 'Reject AI Advisory Recommendation',
      badge: 'REJECTION AUDIT',
      color: 'bg-red-600 hover:bg-red-500 text-white',
    },
    modified: {
      title: 'Modify Setpoints & Approve',
      badge: 'PARAMETER MODIFICATION',
      color: 'bg-amber-500 hover:bg-amber-400 text-slate-950',
    },
  };

  const currentConfig = titles[decisionType];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in">
      <div className="w-full max-w-xl bg-white border border-[#E2E5E9] rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-amber-800 font-bold block">
                {currentConfig.badge}
              </span>
              <h3 className="text-sm font-bold text-slate-900">{currentConfig.title}</h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-3.5 overflow-y-auto flex-1">
          {/* Target Recommendation Context */}
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-500 font-mono uppercase">Well Target</span>
              <span className="text-sm font-mono font-bold text-amber-800">
                {recommendation.wellId}
              </span>
            </div>
            <div className="flex flex-col text-right">
              <span className="text-[10px] text-slate-500 font-mono uppercase">Type</span>
              <span className="text-xs font-mono font-bold text-slate-700 uppercase">
                {recommendation.type} OPTIMIZATION
              </span>
            </div>
            <div className="flex flex-col text-right">
              <span className="text-[10px] text-slate-500 font-mono uppercase">Est. Oil Gain</span>
              <span className="text-sm font-mono font-bold text-emerald-700">
                +{recommendation.expectedGain?.oilBblPerDay ?? 0} bbl/d
              </span>
            </div>
          </div>

          {/* If modify: Allow editing proposed values */}
          {isModify && (
            <div>
              <label className="input-label flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-amber-600" />
                Modify Proposed Parameters (JSON)
              </label>
              <textarea
                value={modifiedJson}
                onChange={(e) => {
                  setModifiedJson(e.target.value);
                  setJsonError(null);
                }}
                rows={4}
                className="w-full bg-slate-50 border border-slate-300 text-slate-900 font-mono text-xs rounded p-2.5 focus:border-amber-600 focus:outline-none"
              />
              {jsonError && <p className="text-xs text-red-600 mt-1">{jsonError}</p>}
            </div>
          )}

          {/* Engineer Name / Signature */}
          <div>
            <label className="input-label">Decision Maker (Engineer Name)</label>
            <input
              type="text"
              value={decidedBy}
              onChange={(e) => setDecidedBy(e.target.value)}
              placeholder="e.g. Petroleum Engineer Lead"
              className="input-field font-mono text-xs"
              required
            />
          </div>

          {/* Mandatory Engineering Reason */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="input-label !mb-0 flex items-center gap-1 text-slate-800">
                <span>Engineering Rationale</span>
                <span className="text-red-500">*</span>
                <span className="text-slate-500 text-[10px] font-normal lowercase">
                  (min 3 characters, mandatory for audit log)
                </span>
              </label>
              <span className="text-[10px] font-mono text-slate-500">
                {reason.trim().length} chars
              </span>
            </div>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Enter technical justification (e.g. 'Confirmed fluid level allows 5 SPM without rod floating risk', 'Steam soak duration optimal for viscosity breakdown')..."
              rows={3}
              className={`input-field font-sans text-xs ${
                !isReasonValid && reason.length > 0 ? 'border-red-500' : ''
              }`}
              required
            />
            {!isReasonValid && (
              <p className="text-[11px] text-amber-700 mt-1 flex items-center gap-1 font-mono">
                <AlertCircle className="w-3.5 h-3.5" />
                Engineering reason is strictly required before submitting decision.
              </p>
            )}
          </div>

          {/* Audit Trail Notice */}
          <div className="p-2.5 bg-slate-50 rounded border border-slate-200 text-[11px] text-slate-600 font-mono flex items-start gap-2">
            <Shield className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
            <span>
              This decision will be cryptographically appended to the immutable system audit trail with timestamp, user ID, and rationale.
            </span>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="btn-secondary text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isReasonValid || isSubmitting}
              className={`px-4 py-2 font-bold rounded text-xs transition-all flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed ${currentConfig.color}`}
            >
              <Check className="w-3.5 h-3.5" />
              {isSubmitting ? 'Recording Decision...' : 'Commit Decision'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
