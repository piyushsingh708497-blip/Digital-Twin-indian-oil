// OIL-TWIN AI - Zustand Global UI State Store
import { create } from 'zustand';
import type { Telemetry } from '../types';

export type WebSocketStatus = 'connecting' | 'connected' | 'reconnecting' | 'stale' | 'offline';

interface AppState {
  selectedWellId: string;
  sidebarCollapsed: boolean;
  wsStatus: WebSocketStatus;
  lastTelemetry: Telemetry | null;
  lastTelemetryTimestamp: number | null;
  activeAlertCount: number;
  unacknowledgedAlertCount: number;

  // Actions
  setSelectedWellId: (id: string) => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setWsStatus: (status: WebSocketStatus) => void;
  setLastTelemetry: (telemetry: Telemetry) => void;
  setActiveAlertCount: (count: number) => void;
  setUnacknowledgedAlertCount: (count: number) => void;
}

export const useAppStore = create<AppState>((set) => ({
  selectedWellId: 'BW-01',
  sidebarCollapsed: false,
  wsStatus: 'connecting',
  lastTelemetry: null,
  lastTelemetryTimestamp: null,
  activeAlertCount: 0,
  unacknowledgedAlertCount: 0,

  setSelectedWellId: (id: string) => set({ selectedWellId: id }),
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setSidebarCollapsed: (collapsed: boolean) => set({ sidebarCollapsed: collapsed }),
  setWsStatus: (status: WebSocketStatus) => set({ wsStatus: status }),
  setLastTelemetry: (telemetry: Telemetry) =>
    set({
      lastTelemetry: telemetry,
      lastTelemetryTimestamp: Date.now(),
    }),
  setActiveAlertCount: (count: number) => set({ activeAlertCount: count }),
  setUnacknowledgedAlertCount: (count: number) => set({ unacknowledgedAlertCount: count }),
}));
