// OIL-TWIN AI - Hand-Built SVG Well Schematic & Cross-Section
// Shows Reservoir -> Sandface -> Wellbore -> Rod String -> Pump -> Tubing -> Wellhead -> Surface
import React, { useState } from 'react';
import type { Telemetry } from '../../types';

export type WellComponentId =
  | 'surface'
  | 'wellhead'
  | 'rod_string'
  | 'tubing'
  | 'pump'
  | 'wellbore'
  | 'sandface'
  | 'reservoir';

interface WellSchematicProps {
  telemetry: Telemetry | null | undefined;
  activeComponent: WellComponentId;
  onSelectComponent: (id: WellComponentId) => void;
}

export const WellSchematic: React.FC<WellSchematicProps> = ({
  telemetry,
  activeComponent,
  onSelectComponent,
}) => {
  const [hovered, setHovered] = useState<WellComponentId | null>(null);

  const isCssActive = telemetry?.css?.steamRate && telemetry.css.steamRate > 0;
  const isSrpActive = telemetry?.srp?.spm && telemetry.srp.spm > 0;

  const getHighlightClass = (id: WellComponentId) => {
    const isSelected = activeComponent === id;
    const isHov = hovered === id;
    if (isSelected) return 'stroke-amber-600 stroke-[3px] filter drop-shadow(0 0 6px rgba(217,119,6,0.5))';
    if (isHov) return 'stroke-sky-600 stroke-[2px] cursor-pointer';
    return 'cursor-pointer transition-all duration-200';
  };

  return (
    <div className="relative bg-white border border-[#E2E5E9] rounded-xl p-4 flex flex-col items-center select-none overflow-hidden shadow-xs">
      {/* Schematic Header & Legend */}
      <div className="w-full flex items-center justify-between mb-2 pb-2 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono font-semibold text-slate-800 uppercase tracking-wider">
            Well-to-Surface Physical Cross-Section
          </span>
          <span className="text-[10px] font-mono bg-slate-50 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">
            Click component to inspect
          </span>
        </div>

        <div className="flex items-center gap-3 text-[11px] font-mono">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-600" />
            <span className="text-slate-600">Steam Injection</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-600" />
            <span className="text-slate-600">Oil Production</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-600" />
            <span className="text-slate-600">Rod Dynamics</span>
          </div>
        </div>
      </div>

      {/* SVG Canvas */}
      <div className="w-full max-w-[620px] aspect-[1/1.4] relative bg-[#FAFAFC] rounded-lg border border-slate-200">
        <svg
          viewBox="0 0 600 840"
          className="w-full h-full"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* Reservoir Rock Pattern (Light Sandstone) */}
            <pattern id="sandstone-pattern" width="20" height="20" patternUnits="userSpaceOnUse">
              <rect width="20" height="20" fill="#FAF6EE" />
              <circle cx="4" cy="4" r="1.2" fill="#D4AF37" opacity="0.4" />
              <circle cx="14" cy="8" r="1.5" fill="#B45309" opacity="0.3" />
              <circle cx="8" cy="16" r="1.2" fill="#92400E" opacity="0.35" />
            </pattern>

            {/* Thermal Gradient in Reservoir */}
            <radialGradient id="thermal-halo" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#EA580C" stopOpacity="0.25" />
              <stop offset="60%" stopColor="#F59E0B" stopOpacity="0.1" />
              <stop offset="100%" stopColor="#FDE68A" stopOpacity="0" />
            </radialGradient>

            {/* Heavy Oil Fluid Gradient */}
            <linearGradient id="heavy-oil" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#15803D" />
              <stop offset="50%" stopColor="#22C55E" />
              <stop offset="100%" stopColor="#15803D" />
            </linearGradient>

            {/* Steel Casing Gradient */}
            <linearGradient id="casing-steel" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#64748B" />
              <stop offset="50%" stopColor="#94A3B8" />
              <stop offset="100%" stopColor="#64748B" />
            </linearGradient>
          </defs>

          {/* ════ 1. RESERVOIR FORMATION (Jodhpur Sandstone, 900-1100m) ════ */}
          <g
            id="reservoir-group"
            className={getHighlightClass('reservoir')}
            onClick={() => onSelectComponent('reservoir')}
            onMouseEnter={() => setHovered('reservoir')}
            onMouseLeave={() => setHovered(null)}
          >
            {/* Rock Formation Box */}
            <rect x="20" y="620" width="560" height="200" fill="url(#sandstone-pattern)" rx="8" />
            <rect x="20" y="620" width="560" height="200" stroke="#B45309" strokeWidth="1.5" fill="none" rx="8" />

            {/* Thermal front propagation contour */}
            <circle cx="300" cy="720" r="160" fill="url(#thermal-halo)" />
            <circle cx="300" cy="720" r="100" fill="none" stroke="#D97706" strokeDasharray="6,4" strokeWidth="1.5" opacity="0.7" />
            <circle cx="300" cy="720" r="140" fill="none" stroke="#EA580C" strokeDasharray="4,6" strokeWidth="1" opacity="0.5" />

            {/* Formation Label */}
            <text x="35" y="645" fill="#92400E" fontSize="12" fontWeight="bold" fontFamily="Inter">
              RESERVOIR: Jodhpur Sandstone
            </text>
            <text x="35" y="662" fill="#475569" fontSize="10" fontFamily="JetBrains Mono">
              Depth: 950-1080 m • 46-48 °C • Heavy Crude (17-19° API)
            </text>

            {/* Steam Front Indicator text */}
            <text x="440" y="645" fill="#B45309" fontSize="11" fontWeight="600" fontFamily="Inter" textAnchor="end">
              Thermal Steam Front
            </text>
            <text x="440" y="662" fill="#92400E" fontSize="10" fontFamily="JetBrains Mono" textAnchor="end">
              Viscosity: ~{telemetry?.reservoir?.temperature ? Math.round(5000 / Math.max(1, (telemetry.reservoir.temperature / 48))) : 4200} cP
            </text>
          </g>

          {/* ════ 2. SANDFACE & PERFORATIONS ════ */}
          <g
            id="sandface-group"
            className={getHighlightClass('sandface')}
            onClick={() => onSelectComponent('sandface')}
            onMouseEnter={() => setHovered('sandface')}
            onMouseLeave={() => setHovered(null)}
          >
            {/* Perforation holes & inflow arrows */}
            {[-60, -40, -20, 0, 20, 40, 60].map((dy, i) => (
              <g key={i}>
                {/* Left perfs */}
                <circle cx="248" cy={720 + dy} r="3.5" fill="#15803D" />
                <line x1="220" y1={720 + dy} x2="244" y2={720 + dy} stroke="#15803D" strokeWidth="2" strokeDasharray="3,2" />
                <polygon points={`244,${718 + dy} 250,${720 + dy} 244,${722 + dy}`} fill="#15803D" />

                {/* Right perfs */}
                <circle cx="352" cy={720 + dy} r="3.5" fill="#15803D" />
                <line x1="380" y1={720 + dy} x2="356" y2={720 + dy} stroke="#15803D" strokeWidth="2" strokeDasharray="3,2" />
                <polygon points={`356,${718 + dy} 350,${720 + dy} 356,${722 + dy}`} fill="#15803D" />
              </g>
            ))}

            <text x="175" y="725" fill="#15803D" fontSize="11" fontWeight="bold" textAnchor="end">
              Perforations
            </text>
          </g>

          {/* ════ 3. CASING & WELLBORE ANNULUS ════ */}
          <g
            id="wellbore-group"
            className={getHighlightClass('wellbore')}
            onClick={() => onSelectComponent('wellbore')}
            onMouseEnter={() => setHovered('wellbore')}
            onMouseLeave={() => setHovered(null)}
          >
            {/* Surface Casing (wider, top section) */}
            <rect x="230" y="160" width="140" height="220" fill="none" stroke="#475569" strokeWidth="3.5" />
            {/* Production Casing */}
            <rect x="245" y="160" width="110" height="600" fill="none" stroke="#64748B" strokeWidth="2.5" />

            {/* Fluid level in wellbore */}
            <rect x="248" y="420" width="104" height="330" fill="url(#heavy-oil)" opacity="0.25" />

            {/* Wellbore fluid level indicator */}
            <line x1="240" y1="420" x2="360" y2="420" stroke="#0284C7" strokeWidth="2" strokeDasharray="4,2" />
            <text x="375" y="424" fill="#0369A1" fontSize="10" fontFamily="JetBrains Mono" fontWeight="bold">
              FLUID LVL: {telemetry?.wellbore?.fluidLevel ? `${telemetry.wellbore.fluidLevel.toFixed(1)} m` : '420 m'}
            </text>
          </g>

          {/* ════ 4. PRODUCTION TUBING ════ */}
          <g
            id="tubing-group"
            className={getHighlightClass('tubing')}
            onClick={() => onSelectComponent('tubing')}
            onMouseEnter={() => setHovered('tubing')}
            onMouseLeave={() => setHovered(null)}
          >
            <rect x="278" y="160" width="44" height="530" fill="#F1F5F9" stroke="#475569" strokeWidth="2" />
            {/* Upward fluid flow animation lines inside tubing */}
            <line x1="288" y1="180" x2="288" y2="670" stroke="#15803D" strokeWidth="1.5" strokeDasharray="8,6" opacity="0.8" />
            <line x1="312" y1="180" x2="312" y2="670" stroke="#15803D" strokeWidth="1.5" strokeDasharray="8,6" opacity="0.8" />
          </g>

          {/* ════ 5. SUCKER ROD STRING ════ */}
          <g
            id="rod-group"
            className={getHighlightClass('rod_string')}
            onClick={() => onSelectComponent('rod_string')}
            onMouseEnter={() => setHovered('rod_string')}
            onMouseLeave={() => setHovered(null)}
          >
            {/* Center Rod Line with couplings */}
            <line x1="300" y1="110" x2="300" y2="670" stroke="#B45309" strokeWidth="4" />
            {/* Rod couplings every 70px */}
            {[200, 270, 340, 410, 480, 550, 620].map((y) => (
              <rect key={y} x="296" y={y} width="8" height="12" fill="#D97706" rx="1.5" />
            ))}
          </g>

          {/* ════ 6. DOWNHOLE SUCKER ROD PUMP ════ */}
          <g
            id="pump-group"
            className={getHighlightClass('pump')}
            onClick={() => onSelectComponent('pump')}
            onMouseEnter={() => setHovered('pump')}
            onMouseLeave={() => setHovered(null)}
          >
            {/* Pump Barrel */}
            <rect x="272" y="660" width="56" height="70" fill="#FFFFFF" stroke="#334155" strokeWidth="2" rx="2" />
            {/* Plunger */}
            <rect x="280" y="675" width="40" height="40" fill="#E2E8F0" stroke="#B45309" strokeWidth="2" />
            {/* Traveling Valve Ball */}
            <circle cx="300" cy="688" r="5" fill="#D97706" />
            {/* Standing Valve Ball */}
            <circle cx="300" cy="722" r="5" fill="#15803D" />

            <text x="210" y="695" fill="#B45309" fontSize="11" fontWeight="bold" textAnchor="end">
              Downhole Pump
            </text>
            <text x="210" y="710" fill="#64748B" fontSize="9" fontFamily="JetBrains Mono" textAnchor="end">
              Fillage: {telemetry?.srp?.pumpFillagePct ? `${telemetry.srp.pumpFillagePct.toFixed(0)}%` : '85%'}
            </text>
          </g>

          {/* ════ 7. WELLHEAD (CHRISTMAS TREE & STUFFING BOX) ════ */}
          <g
            id="wellhead-group"
            className={getHighlightClass('wellhead')}
            onClick={() => onSelectComponent('wellhead')}
            onMouseEnter={() => setHovered('wellhead')}
            onMouseLeave={() => setHovered(null)}
          >
            {/* Wellhead flange and valves */}
            <rect x="250" y="140" width="100" height="22" fill="#E2E8F0" stroke="#475569" strokeWidth="2" rx="3" />
            {/* Stuffing Box */}
            <rect x="286" y="110" width="28" height="30" fill="#CBD5E1" stroke="#B45309" strokeWidth="1.5" />
            {/* Polished Rod */}
            <line x1="300" y1="50" x2="300" y2="110" stroke="#B45309" strokeWidth="5" />

            {/* Left Wing Valve - Steam Injection line */}
            <path d="M 250 150 L 170 150 L 170 120" fill="none" stroke="#2563EB" strokeWidth="4" />
            <polygon points="166,120 174,120 170,110" fill="#2563EB" />
            <text x="165" y="100" fill="#1D4ED8" fontSize="10" fontWeight="bold" textAnchor="end">
              CSS Steam Line
            </text>

            {/* Right Wing Valve - Production Line */}
            <path d="M 350 150 L 440 150 L 440 120" fill="none" stroke="#15803D" strokeWidth="4" />
            <polygon points="440,110 444,120 436,120" fill="#15803D" />
            <text x="445" y="100" fill="#15803D" fontSize="10" fontWeight="bold">
              Oil Flow Line
            </text>
          </g>

          {/* ════ 8. SURFACE SRP WALKING BEAM UNIT ════ */}
          <g
            id="surface-group"
            className={getHighlightClass('surface')}
            onClick={() => onSelectComponent('surface')}
            onMouseEnter={() => setHovered('surface')}
            onMouseLeave={() => setHovered(null)}
          >
            {/* Samson Post (A-Frame) */}
            <line x1="210" y1="140" x2="160" y2="50" stroke="#475569" strokeWidth="4" />
            <line x1="110" y1="140" x2="160" y2="50" stroke="#475569" strokeWidth="4" />
            <line x1="130" y1="100" x2="190" y2="100" stroke="#64748B" strokeWidth="3" />

            {/* Walking Beam */}
            <line x1="80" y1="70" x2="260" y2="35" stroke="#B45309" strokeWidth="6" strokeLinecap="round" />
            {/* Horsehead */}
            <path d="M 260 35 Q 295 40 300 70" fill="none" stroke="#B45309" strokeWidth="8" />
            {/* Bridle wire */}
            <line x1="300" y1="65" x2="300" y2="85" stroke="#64748B" strokeWidth="2" />

            {/* Counterweight & Crank */}
            <circle cx="80" cy="115" r="14" fill="#CBD5E1" stroke="#B45309" strokeWidth="2" />
            <line x1="80" y1="70" x2="80" y2="115" stroke="#64748B" strokeWidth="3" />

            {/* Electric Motor */}
            <rect x="40" y="115" width="28" height="25" fill="#E2E8F0" stroke="#15803D" strokeWidth="1.5" rx="2" />
            <text x="54" y="132" fill="#15803D" fontSize="8" fontWeight="bold" textAnchor="middle">
              VFD
            </text>

            <text x="60" y="30" fill="#92400E" fontSize="12" fontWeight="bold">
              SRP Surface Pumping Unit
            </text>
          </g>

          {/* Active Status Badges on SVG */}
          {isCssActive && (
            <g transform="translate(140, 165)">
              <rect width="110" height="22" rx="4" fill="#EFF6FF" stroke="#3B82F6" strokeWidth="1" />
              <text x="55" y="15" fill="#1D4ED8" fontSize="10" fontFamily="JetBrains Mono" fontWeight="bold" textAnchor="middle">
                STEAM INJECTING
              </text>
            </g>
          )}

          {isSrpActive && (
            <g transform="translate(360, 165)">
              <rect width="110" height="22" rx="4" fill="#F0FDF4" stroke="#22C55E" strokeWidth="1" />
              <text x="55" y="15" fill="#15803D" fontSize="10" fontFamily="JetBrains Mono" fontWeight="bold" textAnchor="middle">
                PUMPING ({telemetry?.srp?.spm || 4.5} SPM)
              </text>
            </g>
          )}
        </svg>
      </div>
    </div>
  );
};
