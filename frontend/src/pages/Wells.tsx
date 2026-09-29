// OIL-TWIN AI - Wells Overview Page
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowUpRight,
  Filter,
  Layers,
  Search,
} from 'lucide-react';
import { getAlerts, getWells } from '../services/api';
import { useAppStore } from '../store/useAppStore';
import { StatusBadge } from '../components/ui/StatusBadge';
import { ErrorState, LoadingSkeleton } from '../components/ui/FeedbackStates';

export const Wells: React.FC = () => {
  const navigate = useNavigate();
  const { setSelectedWellId, selectedWellId } = useAppStore();
  const [phaseFilter, setPhaseFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const { data: wells, isLoading, isError, refetch } = useQuery({
    queryKey: ['wells'],
    queryFn: getWells,
  });

  const { data: alerts } = useQuery({
    queryKey: ['alerts'],
    queryFn: () => getAlerts(),
  });

  if (isError) {
    return (
      <ErrorState
        title="Failed to Load Wells"
        message="Could not retrieve field well inventory from the backend service."
        onRetry={refetch}
      />
    );
  }

  const filteredWells = (wells || []).filter((w) => {
    const matchesPhase = phaseFilter === 'all' || w.cssCyclePhase.toLowerCase() === phaseFilter;
    const matchesSearch =
      w.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      w.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesPhase && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl bg-white border border-[#E2E5E9] shadow-xs">
        <div>
          <h1 className="text-lg font-bold text-slate-900 tracking-wide flex items-center gap-2">
            <Layers className="w-5 h-5 text-amber-600" />
            Field Well Inventory & Status
          </h1>
          <p className="text-xs text-slate-500 font-mono mt-0.5">
            Baghewala Heavy Oil Field • 10 Monitored Producer Wells • Cyclic Steam Stimulation (CSS)
          </p>
        </div>

        {/* Filter and Search Bar */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Search box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search well ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-white border border-[#E2E5E9] rounded-md pl-8 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-600 font-mono shadow-xs"
            />
          </div>

          {/* Phase Filter Tabs */}
          <div className="flex items-center gap-1 bg-slate-50 border border-[#E2E5E9] rounded-md p-0.5">
            <Filter className="w-3 h-3 text-slate-500 ml-1 mr-0.5" />
            {['all', 'production', 'injection', 'soak', 'idle'].map((phase) => (
              <button
                key={phase}
                onClick={() => setPhaseFilter(phase)}
                className={`px-2 py-1 rounded text-[11px] font-mono transition-colors ${
                  phaseFilter === phase
                    ? 'bg-amber-600 text-white font-bold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {phase.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Well Cards Grid */}
      {isLoading ? (
        <LoadingSkeleton rows={4} height="h-28" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
          {filteredWells.map((well) => {
            const isSelected = well.id === selectedWellId;
            const wellAlerts = (alerts || []).filter((a) => a.wellId === well.id && !a.acknowledged);

            return (
              <div
                key={well.id}
                onClick={() => {
                  setSelectedWellId(well.id);
                  navigate(`/wells/${well.id}`);
                }}
                className={`group bg-white border rounded-xl p-3.5 cursor-pointer transition-all duration-150 flex flex-col justify-between shadow-xs ${
                  isSelected
                    ? 'border-amber-400 bg-amber-50/40'
                    : 'border-[#E2E5E9] hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between mb-2.5">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-base font-mono font-bold text-slate-900 group-hover:text-amber-800 transition-colors">
                          {well.id}
                        </span>
                        {isSelected && (
                          <span className="text-[10px] bg-amber-100 text-amber-900 border border-amber-300 px-1.5 py-0.2 rounded font-mono font-semibold">
                            ACTIVE
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-slate-500 font-sans block mt-0.5">
                        {well.name}
                      </span>
                    </div>
                    <StatusBadge type="phase" value={well.cssCyclePhase} />
                  </div>

                  <div className="space-y-1.5 text-xs font-mono py-2 border-y border-slate-100">
                    <div className="flex justify-between text-slate-500">
                      <span>Status</span>
                      <span className="text-slate-800 font-semibold">{well.status}</span>
                    </div>
                    <div className="flex justify-between text-slate-500">
                      <span>CSS Cycle</span>
                      <span className="text-amber-800 font-bold">#{well.cycleNumber}</span>
                    </div>
                    <div className="flex justify-between text-slate-500">
                      <span>Formation</span>
                      <span className="text-slate-700">Jodhpur Sandstone</span>
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-2 flex items-center justify-between text-xs">
                  {wellAlerts.length > 0 ? (
                    <span className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-800 border border-rose-200 font-mono text-[10px] flex items-center gap-1 font-semibold">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
                      {wellAlerts.length} Alert{wellAlerts.length > 1 ? 's' : ''}
                    </span>
                  ) : (
                    <span className="text-emerald-700 font-mono text-[11px] flex items-center gap-1 font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      Operational
                    </span>
                  )}
                  <span className="text-amber-700 group-hover:text-amber-800 font-mono flex items-center gap-1 transition-colors font-medium">
                    <span>Workspace</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Wells;
