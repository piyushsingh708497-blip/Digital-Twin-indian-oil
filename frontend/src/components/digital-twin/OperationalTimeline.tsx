// OIL-TWIN AI - Operational Timeline & CSS Cycle Milestones
// Displays high-density technical timeline of Cyclic Steam Stimulation stages and SRP operating regimes

import React from 'react';
import { Flame, Clock, Droplets, AlertCircle } from 'lucide-react';
import type { CssCyclePhase } from '../../types';

interface OperationalTimelineProps {
  currentPhase: CssCyclePhase;
  cycleNumber: number;
  currentDay?: number;
  totalCycleDays?: number;
  isOptimized?: boolean;
}

export const OperationalTimeline: React.FC<OperationalTimelineProps> = ({
  currentPhase = 'production',
  cycleNumber = 3,
  currentDay = 18,
  totalCycleDays = 60,
  isOptimized = false,
}) => {
  const stages = [
    {
      phase: 'injection' as CssCyclePhase,
      name: 'Steam Injection',
      duration: 'Day 1–8',
      daysRange: [1, 8],
      detail: '1,800 tonnes @ 140 bar • 75% quality',
      status: currentDay > 8 ? 'completed' : currentPhase === 'injection' ? 'active' : 'upcoming',
      icon: Flame,
    },
    {
      phase: 'soak' as CssCyclePhase,
      name: 'Thermal Soak',
      duration: 'Day 9–14',
      daysRange: [9, 14],
      detail: 'Radial heat dissipation • Viscosity reduction to 50 cP',
      status: currentDay > 14 ? 'completed' : currentDay >= 9 && currentDay <= 14 ? 'active' : 'upcoming',
      icon: Clock,
    },
    {
      phase: 'production' as CssCyclePhase,
      name: 'SRP Production Flow',
      duration: 'Day 15–50',
      daysRange: [15, 50],
      detail: isOptimized
        ? 'Optimized: 3.2m stroke @ 5.2 SPM (99.5 m³/d peak)'
        : 'Baseline: 2.8m stroke @ 4.5 SPM (80.1 m³/d peak)',
      status: currentDay >= 15 && currentDay <= 50 ? 'active' : currentDay > 50 ? 'completed' : 'upcoming',
      icon: Droplets,
    },
    {
      phase: 'idle' as CssCyclePhase,
      name: 'Cutoff & Re-Steaming',
      duration: 'Day 51–60',
      daysRange: [51, 60],
      detail: 'Water cut reaches 90% threshold • Planning Cycle #4',
      status: currentDay > 50 ? 'active' : 'upcoming',
      icon: AlertCircle,
    },
  ];

  const progressPct = Math.min(100, Math.round((currentDay / totalCycleDays) * 100));

  return (
    <div className="bg-white border border-[#E2E8F0] rounded-md p-3.5 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3 pb-2 border-b border-[#F1F4F6]">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono font-bold text-slate-800 uppercase tracking-wider">
            OPERATIONAL CYCLE TIMELINE
          </span>
          <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 font-semibold border border-slate-200">
            CSS CYCLE #{cycleNumber}
          </span>
          {isOptimized && (
            <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-800 font-bold border border-emerald-300">
              OPTIMIZED SCHEDULE
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 text-xs font-mono text-slate-500">
          <span>
            CYCLE DAY: <b className="text-slate-900">{currentDay}</b> / {totalCycleDays}
          </span>
          <span className="text-slate-300">|</span>
          <span>
            PHASE: <b className="text-emerald-700 uppercase">{currentPhase}</b>
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-[#F1F4F6] rounded-full h-1.5 mb-3 overflow-hidden">
        <div
          className="bg-emerald-600 h-1.5 rounded-full transition-all duration-300"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Stage Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
        {stages.map((stage) => {
          const Icon = stage.icon;
          const isActive = stage.status === 'active';
          const isCompleted = stage.status === 'completed';

          return (
            <div
              key={stage.phase}
              className={`p-2.5 rounded border text-left transition-colors ${
                isActive
                  ? 'bg-emerald-50/60 border-emerald-300 text-emerald-950'
                  : isCompleted
                  ? 'bg-[#F8FAFC] border-[#E2E8F0] text-slate-600'
                  : 'bg-white border-[#E2E8F0] text-slate-400'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <Icon
                    className={`w-3.5 h-3.5 ${
                      isActive ? 'text-emerald-700' : isCompleted ? 'text-slate-500' : 'text-slate-400'
                    }`}
                  />
                  <span className="text-[11px] font-bold font-sans tracking-tight">
                    {stage.name}
                  </span>
                </div>
                <span className="text-[9px] font-mono font-semibold px-1 py-0.2 rounded bg-white/80 border border-slate-200">
                  {stage.duration}
                </span>
              </div>
              <p className="text-[10px] font-mono leading-tight text-slate-600 line-clamp-2">
                {stage.detail}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default OperationalTimeline;
