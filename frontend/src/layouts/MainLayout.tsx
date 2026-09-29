// OIL-TWIN AI - Main Layout Container
import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from '../components/layout/Sidebar';
import { TopBar } from '../components/layout/TopBar';
import { useTelemetryWebSocket } from '../hooks/useTelemetryWebSocket';
import { useAppStore } from '../store/useAppStore';

export const MainLayout: React.FC = () => {
  const { selectedWellId } = useAppStore();

  // Run persistent WebSocket stream for the selected well across all pages
  useTelemetryWebSocket(selectedWellId);

  return (
    <div className="flex h-screen w-screen bg-[#F7F8FA] text-[#111827] overflow-hidden font-sans">
      {/* Left Collapsible Navigation */}
      <Sidebar />

      {/* Main Command Center Workspace */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar />

        {/* Scrollable Content Viewport */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-[#F7F8FA]">
          <div className="max-w-[1720px] mx-auto space-y-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
