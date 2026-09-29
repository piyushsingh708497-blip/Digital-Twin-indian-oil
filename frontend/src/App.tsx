// OIL-TWIN AI - Production Application Router & Query Client Provider
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import MainLayout from './layouts/MainLayout';
import Dashboard from './pages/Dashboard';
import Wells from './pages/Wells';
import WellWorkspace from './pages/WellWorkspace';
import DigitalTwin from './pages/DigitalTwin';
import CSSOptimizer from './pages/CSSOptimizer';
import SRPOptimizer from './pages/SRPOptimizer';
import JointOptimizer from './pages/JointOptimizer';
import WhatIfSimulator from './pages/WhatIfSimulator';
import ScenarioComparison from './pages/ScenarioComparison';
import Recommendations from './pages/Recommendations';
import Alerts from './pages/Alerts';
import Audit from './pages/Audit';
import DataHealth from './pages/DataHealth';
import Settings from './pages/Settings';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5000,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route element={<MainLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/wells" element={<Wells />} />
            <Route path="/wells/:wellId" element={<WellWorkspace />} />
            <Route path="/digital-twin" element={<DigitalTwin />} />
            <Route path="/css" element={<CSSOptimizer />} />
            <Route path="/srp" element={<SRPOptimizer />} />
            <Route path="/joint" element={<JointOptimizer />} />
            <Route path="/what-if" element={<WhatIfSimulator />} />
            <Route path="/scenario-comparison" element={<ScenarioComparison />} />
            <Route path="/recommendations" element={<Recommendations />} />
            <Route path="/alerts" element={<Alerts />} />
            <Route path="/audit" element={<Audit />} />
            <Route path="/data-health" element={<DataHealth />} />
            <Route path="/settings" element={<Settings />} />
            {/* Fallback & redirects */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
