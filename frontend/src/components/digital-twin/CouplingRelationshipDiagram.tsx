// OIL-TWIN AI - Joint CSS + SRP Coupling & Feedback Relationship Diagram
// Visualizes the thermodynamic-to-mechanical forward chain and hydraulic feedback loop between reservoir soak and pumpjack lift

import React, { useState } from 'react';
import {
  Flame,
  Thermometer,
  Droplets,
  Activity,
  CheckCircle2,
  Zap,
} from 'lucide-react';

export const CouplingRelationshipDiagram: React.FC = () => {
  const [selectedStep, setSelectedStep] = useState<number | null>(null);

  const steps = [
    {
      id: 1,
      title: '1. CSS Steam Enthalpy',
      badge: 'THERMODYNAMIC INPUT',
      icon: Flame,
      color: 'border-amber-300 bg-amber-50/70 text-amber-950',
      iconColor: 'text-amber-700',
      description: 'Superheated steam (140 bar, 75% quality) injects enthalpy into Jodhpur Sandstone reservoir.',
      metric: '1,800 t Steam • 2,450 kJ/kg',
    },
    {
      id: 2,
      title: '2. Temperature Elevation',
      badge: 'HEAT TRANSFER',
      icon: Thermometer,
      color: 'border-amber-300 bg-amber-50/70 text-amber-950',
      iconColor: 'text-amber-700',
      description: 'Radial conduction & convection heats drainage area around wellbore from 65°C to 182°C.',
      metric: 'ΔT: +117°C • 18m Radius',
    },
    {
      id: 3,
      title: '3. Viscosity Collapse',
      badge: 'FLUID MOBILITY',
      icon: Droplets,
      color: 'border-emerald-300 bg-emerald-50/70 text-emerald-950',
      iconColor: 'text-emerald-700',
      description: 'Extreme heavy oil (17.5° API) viscosity plummets exponentially via Andrade temperature relationship.',
      metric: '10,000 cP → 48 cP (-99.5%)',
    },
    {
      id: 4,
      title: '4. Pump Inflow & Loading',
      badge: 'DYNAMIC MECHANICAL',
      icon: Activity,
      color: 'border-emerald-300 bg-emerald-50/70 text-emerald-950',
      iconColor: 'text-emerald-700',
      description: 'Fluidity prevents downhole rod floating on downstroke and eliminates severe fluid pound.',
      metric: 'Rod Stress: 84% → 65% (Safe)',
    },
    {
      id: 5,
      title: '5. SRP VFD Tuning',
      badge: 'SURFACE KINEMATICS',
      icon: Zap,
      color: 'border-slate-300 bg-slate-50 text-slate-900',
      iconColor: 'text-slate-700',
      description: 'VFD dynamically matches stroke displacement (3.2m @ 5.2 SPM) to high mobility inflow regime.',
      metric: 'Fillage: 91% • 5.4 kW',
    },
    {
      id: 6,
      title: '6. Optimized Production',
      badge: 'NET OUTCOME',
      icon: CheckCircle2,
      color: 'border-emerald-300 bg-emerald-50/70 text-emerald-950',
      iconColor: 'text-emerald-700',
      description: 'Elevated production plateau achieved with minimized Steam-Oil Ratio and low rod fatigue.',
      metric: '+24.3% Oil Lift • 3.35 t/m³ SOR',
    },
  ];

  return (
    <div className="bg-white border border-[#E2E8F0] rounded-md p-4 shadow-xs select-none">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3 pb-2 border-b border-[#F1F4F6]">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono font-bold text-slate-800 uppercase tracking-wider">
              COUPLED DIGITAL TWIN: FORWARD PHYSICS & REVERSE HYDRAULIC FEEDBACK
            </span>
            <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-800 border border-emerald-300 font-bold">
              CORE INNOVATION
            </span>
          </div>
          <p className="text-[11px] text-slate-500 font-sans mt-0.5">
            Synchronizes subsurface Boberg-Lundberg thermal dissipation with sucker rod wave mechanics
          </p>
        </div>

        <span className="text-[10px] font-mono text-slate-400">
          Click any step to inspect coupling mechanics
        </span>
      </div>

      {/* Forward Thermodynamic Chain (Steps 1 to 6) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-2 relative">
        {steps.map((step) => {
          const Icon = step.icon;
          const isSelected = selectedStep === step.id;

          return (
            <div
              key={step.id}
              onClick={() => setSelectedStep(isSelected ? null : step.id)}
              className={`p-2.5 rounded border cursor-pointer transition-all duration-150 flex flex-col justify-between ${
                step.color
              } ${isSelected ? 'ring-2 ring-emerald-600 shadow-sm' : 'hover:border-slate-400'}`}
            >
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[8px] font-mono font-bold uppercase tracking-wider opacity-70">
                    {step.badge}
                  </span>
                  <Icon className={`w-3.5 h-3.5 ${step.iconColor}`} />
                </div>
                <h4 className="text-xs font-bold font-sans tracking-tight mb-1">
                  {step.title}
                </h4>
                <p className="text-[10px] font-mono leading-tight opacity-80 mb-2">
                  {step.description}
                </p>
              </div>

              <div className="pt-1.5 border-t border-current/15 text-[10px] font-mono font-bold">
                {step.metric}
              </div>
            </div>
          );
        })}
      </div>

      {/* Reverse Hydraulic Feedback Loop Bar */}
      <div className="mt-3 p-2.5 rounded bg-[#F8FAFC] border border-[#CBD5E1] flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs font-mono text-slate-700">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-[10px]">
            ↺
          </div>
          <div>
            <span className="font-bold text-slate-900 block leading-none">
              REVERSE HYDRAULIC FEEDBACK INTO NEXT CSS CYCLE:
            </span>
            <span className="text-[11px] text-slate-500 leading-tight">
              SRP pump displacement drives bottomhole drawdown → accelerated reservoir cooling & cold water influx → triggers CSS cycle termination when water cut hits 90%.
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[10px] font-mono font-bold text-slate-800 bg-white px-2 py-1 rounded border border-slate-200">
          <span>CYCLE SHIFT CRITERIA:</span>
          <span className="text-rose-700">WC &gt; 90%</span>
          <span className="text-slate-300">|</span>
          <span className="text-amber-800">SOR &gt; 4.5</span>
        </div>
      </div>
    </div>
  );
};

export default CouplingRelationshipDiagram;
