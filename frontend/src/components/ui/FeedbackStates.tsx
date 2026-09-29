// OIL-TWIN AI - Loading Skeleton, Error State, and Empty State components
import React from 'react';
import { AlertTriangle, RefreshCw, Database } from 'lucide-react';

export const LoadingSkeleton: React.FC<{ rows?: number; height?: string }> = ({
  rows = 3,
  height = 'h-16',
}) => {
  return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className={`bg-slate-200/80 rounded-lg border border-slate-300/60 ${height}`} />
      ))}
    </div>
  );
};

export const ErrorState: React.FC<{
  title?: string;
  message?: string;
  onRetry?: () => void;
}> = ({
  title = 'Data Unavailable',
  message = 'Failed to load telemetry from backend service.',
  onRetry,
}) => {
  return (
    <div className="bg-rose-50 border border-rose-200 rounded-lg p-6 flex flex-col items-center text-center shadow-xs">
      <div className="p-3 bg-rose-100 rounded-full text-rose-700 mb-3 border border-rose-200">
        <AlertTriangle className="w-6 h-6" />
      </div>
      <h4 className="text-sm font-semibold text-rose-900 mb-1 font-mono tracking-wide uppercase">{title}</h4>
      <p className="text-xs text-rose-800/80 max-w-md mb-4">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="btn-secondary text-xs flex items-center gap-2">
          <RefreshCw className="w-3.5 h-3.5" />
          Retry Connection
        </button>
      )}
    </div>
  );
};

export const EmptyState: React.FC<{
  title?: string;
  message?: string;
  actionText?: string;
  onAction?: () => void;
}> = ({
  title = 'No Data Found',
  message = 'There are no active records for the selected criteria.',
  actionText,
  onAction,
}) => {
  return (
    <div className="bg-white border border-[#E2E5E9] rounded-lg p-8 flex flex-col items-center text-center shadow-xs">
      <div className="p-3 bg-slate-100 rounded-full text-slate-500 mb-3 border border-slate-200">
        <Database className="w-6 h-6 text-slate-500" />
      </div>
      <h4 className="text-sm font-semibold text-slate-800 mb-1 font-mono tracking-wide uppercase">{title}</h4>
      <p className="text-xs text-slate-500 max-w-sm mb-4">{message}</p>
      {actionText && onAction && (
        <button onClick={onAction} className="btn-secondary text-xs">
          {actionText}
        </button>
      )}
    </div>
  );
};
