// OIL-TWIN AI - Command Center Left Navigation Sidebar (Industrial Redesign)
import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Cpu,
  Flame,
  Activity,
  AlertTriangle,
  GitMerge,
  Radio,
  History,
  ShieldCheck,
  Settings,
  ChevronLeft,
  ChevronRight,
  Database,
  Lightbulb,
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

const NAV_ITEMS = [
  { path: '/', label: 'Command Center', icon: LayoutDashboard },
  { path: '/digital-twin', label: 'Digital Twin', icon: Cpu },
  { path: '/css', label: 'CSS Optimization', icon: Flame },
  { path: '/srp', label: 'SRP Analysis', icon: Activity },
  { path: '/what-if', label: 'Failure Risk', icon: AlertTriangle },
  { path: '/joint', label: 'Coupled Optimizer', icon: GitMerge },
  { path: '/wells', label: 'SCADA / Telemetry', icon: Radio },
  { path: '/recommendations', label: 'Recommendations', icon: Lightbulb },
  { path: '/audit', label: 'Decision Log', icon: History },
  { path: '/data-health', label: 'Data Quality', icon: ShieldCheck },
  { path: '/settings', label: 'System', icon: Settings },
];

export const Sidebar: React.FC = () => {
  const {
    sidebarCollapsed,
    toggleSidebar,
    selectedWellId,
    unacknowledgedAlertCount,
    wsStatus,
  } = useAppStore();

  return (
    <aside
      className={`relative flex flex-col bg-white border-r border-[#E2E8F0] transition-all duration-150 z-30 select-none shadow-xs ${
        sidebarCollapsed ? 'w-16' : 'w-56'
      }`}
    >
      {/* Brand & Subheader */}
      <div className="flex items-center justify-between h-13 px-3 border-b border-[#E2E8F0] bg-[#F8FAFC]">
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="w-7 h-7 rounded bg-slate-900 flex items-center justify-center flex-shrink-0 text-white font-mono font-bold text-xs">
            OT
          </div>
          {!sidebarCollapsed && (
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-mono font-bold text-slate-900 tracking-wider">
                OIL-TWIN AI
              </span>
              <span className="text-[9px] text-slate-400 font-mono tracking-tight uppercase truncate">
                Baghewala Heavy Oil
              </span>
            </div>
          )}
        </div>
        <button
          onClick={toggleSidebar}
          className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
          title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {sidebarCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Target Well Indicator */}
      <div className="p-2 border-b border-[#E2E8F0] bg-[#F8FAFC]">
        <NavLink
          to={`/wells/${selectedWellId}`}
          className={`flex items-center gap-2 p-1.5 rounded bg-white border border-[#CBD5E1] transition-colors ${
            sidebarCollapsed ? 'justify-center' : ''
          }`}
          title="Active Target Well"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-600 flex-shrink-0" />
          {!sidebarCollapsed && (
            <div className="flex flex-col min-w-0 leading-none">
              <span className="text-[8px] uppercase font-mono font-semibold text-slate-400 tracking-wider">
                ACTIVE TARGET
              </span>
              <span className="text-xs font-mono font-bold text-slate-900 truncate mt-0.5">
                {selectedWellId}
              </span>
            </div>
          )}
        </NavLink>
      </div>

      {/* Nav Items */}
      <nav className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `group relative flex items-center gap-2.5 px-2.5 py-1.5 rounded text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-slate-100 text-slate-900 font-semibold border border-slate-300'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-transparent'
                } ${sidebarCollapsed ? 'justify-center px-1.5' : ''}`
              }
              title={sidebarCollapsed ? item.label : undefined}
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute left-0 top-1 bottom-1 w-[3px] bg-emerald-700 rounded-r" />
                  )}
                  <div className="relative flex-shrink-0">
                    <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-emerald-700' : 'text-slate-400 group-hover:text-slate-600'}`} />
                    {item.path === '/alerts' && unacknowledgedAlertCount > 0 && (
                      <span className="absolute -top-1 -right-1 w-1.5 h-1.5 rounded-full bg-rose-600" />
                    )}
                  </div>
                  {!sidebarCollapsed && (
                    <span className="truncate flex-1 tracking-tight text-[11px] font-sans">
                      {item.label}
                    </span>
                  )}
                  {!sidebarCollapsed && item.path === '/recommendations' && (
                    <span className="px-1 py-0.2 text-[9px] font-mono bg-emerald-50 text-emerald-800 border border-emerald-200 rounded font-semibold">
                      AI
                    </span>
                  )}
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Footer System Status */}
      <div className="p-2 border-t border-[#E2E8F0] bg-[#F8FAFC] space-y-1.5">
        <div
          className={`flex items-center gap-1.5 p-1.5 rounded bg-white border border-[#CBD5E1] text-[10px] font-mono ${
            sidebarCollapsed ? 'justify-center' : ''
          }`}
          title="Operating in simulated telemetry physics mode."
        >
          <Database className="w-3 h-3 text-slate-500 flex-shrink-0" />
          {!sidebarCollapsed && (
            <div className="flex flex-col min-w-0 leading-tight">
              <span className="font-bold text-slate-800 flex items-center gap-1">
                <span className="w-1 h-1 rounded-full bg-amber-500" />
                SIMULATED DATA
              </span>
              <span className="text-[8px] text-slate-400">Physics Twin v2.0</span>
            </div>
          )}
        </div>

        {!sidebarCollapsed && (
          <div className="flex items-center justify-between text-[9px] font-mono text-slate-400 px-1">
            <span>LINK: {wsStatus.toUpperCase()}</span>
            <span>OPC-UA OK</span>
          </div>
        )}
      </div>
    </aside>
  );
};
