import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Cpu,
  RefreshCw,
  Sparkles,
  Layers,
  Box,
} from 'lucide-react';
import { getWellState } from '../services/api';
import { useAppStore } from '../store/useAppStore';
import type { WellComponentId } from '../components/digital-twin/WellSchematic';
import { WellSchematic } from '../components/digital-twin/WellSchematic';
import { ThreeWellTwin } from '../components/digital-twin/ThreeWellTwin';
import { TwinComponentDetails } from '../components/digital-twin/TwinComponentDetails';
import { ErrorState, LoadingSkeleton } from '../components/ui/FeedbackStates';

export const DigitalTwin: React.FC = () => {
  const { selectedWellId, lastTelemetry } = useAppStore();
  const [activeComponent, setActiveComponent] = useState<WellComponentId>('reservoir');
  const [viewMode, setViewMode] = useState<'3d' | '2d'>('3d');
  const [isOptimized, setIsOptimized] = useState(false);

  const { data: wellState, isLoading, isError, refetch } = useQuery({
    queryKey: ['wellState', selectedWellId],
    queryFn: () => getWellState(selectedWellId),
    refetchInterval: 12000,
  });

  const activeTel = lastTelemetry || wellState?.telemetry;

  if (isError) {
    return (
      <ErrorState
        title="Digital Twin Physics Offline"
        message={`Could not load physics state for well ${selectedWellId}. Ensure backend is running.`}
        onRetry={refetch}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Studio Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-md bg-white border border-[#E2E8F0] shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono font-bold text-slate-800 uppercase tracking-widest">
              WELL-TO-SURFACE DIGITAL TWIN STUDIO
            </span>
            <span className="text-[10px] font-mono bg-[#F1F4F6] text-slate-700 px-2 py-0.5 rounded border border-[#CBD5E1]">
              Baghewala Field • {selectedWellId}
            </span>
          </div>
          <h1 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Cpu className="w-4 h-4 text-emerald-700" />
            First-Principles Coupled Well Twin
          </h1>
          <p className="text-[11px] text-slate-500 font-mono mt-0.5">
            Boberg-Lundberg reservoir thermal heating coupled with Gibbs 1D damped wave sucker rod dynamics
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* 3D vs 2D Toggle */}
          <div className="flex items-center p-0.5 rounded bg-[#F1F4F6] border border-[#CBD5E1]">
            <button
              onClick={() => setViewMode('3d')}
              className={`px-2.5 py-1 rounded text-xs font-mono font-bold flex items-center gap-1.5 transition-all ${
                viewMode === '3d'
                  ? 'bg-white text-slate-900 shadow-xs border border-[#CBD5E1]'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Box className="w-3.5 h-3.5 text-emerald-700" />
              <span>3D WebGL</span>
            </button>
            <button
              onClick={() => setViewMode('2d')}
              className={`px-2.5 py-1 rounded text-xs font-mono font-bold flex items-center gap-1.5 transition-all ${
                viewMode === '2d'
                  ? 'bg-white text-slate-900 shadow-xs border border-[#CBD5E1]'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-slate-600" />
              <span>2D Cross-Section</span>
            </button>
          </div>

          {/* What-If State Toggle */}
          <button
            onClick={() => setIsOptimized(!isOptimized)}
            className={`px-2.5 py-1 rounded text-xs font-mono font-bold border transition-colors flex items-center gap-1.5 ${
              isOptimized
                ? 'bg-emerald-700 text-white border-emerald-800'
                : 'bg-white text-slate-700 border-[#CBD5E1] hover:bg-slate-50'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{isOptimized ? 'Optimized State Active' : 'Preview Optimized Twin'}</span>
          </button>

          <button
            onClick={() => refetch()}
            className="p-1.5 rounded bg-white hover:bg-slate-50 border border-[#CBD5E1] text-slate-600 hover:text-slate-900 shadow-xs transition-colors"
            title="Refresh Physics Telemetry"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Two-Column Digital Twin Canvas */}
      {isLoading && !activeTel ? (
        <LoadingSkeleton rows={3} height="h-64" />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* Visual Model (3D or 2D) */}
          <div className="lg:col-span-7 xl:col-span-8">
            {viewMode === '3d' ? (
              <ThreeWellTwin
                telemetry={activeTel}
                activeComponent={activeComponent}
                onSelectComponent={setActiveComponent}
                isOptimized={isOptimized}
                optimizedTelemetry={{
                  srp: {
                    ...activeTel?.srp,
                    spm: 5.2,
                    strokeLength: 3.2,
                    rodLoadMax: 62.0,
                    pumpFillagePct: 91,
                  } as any,
                  surface: {
                    ...activeTel?.surface,
                    oilRate: 99.5,
                  } as any,
                  reservoir: {
                    ...activeTel?.reservoir,
                    temperature: 182.0,
                  } as any,
                }}
                height="h-[640px]"
                showControlsBar={true}
              />
            ) : (
              <WellSchematic
                telemetry={activeTel}
                activeComponent={activeComponent}
                onSelectComponent={setActiveComponent}
              />
            )}
          </div>

          {/* Component Parameter Inspector */}
          <div className="lg:col-span-5 xl:col-span-4">
            <TwinComponentDetails
              componentId={activeComponent}
              telemetry={activeTel}
              onSelectComponent={setActiveComponent}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default DigitalTwin;
