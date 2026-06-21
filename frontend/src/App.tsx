import React, { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import ErrorBoundary from './components/ErrorBoundary';
import DashboardSkeleton from './components/DashboardSkeleton';
import { useAuthStore } from "./store/authStore";
import CommandPalette from './components/CommandPalette';
import { MainLayout } from './components/layout/MainLayout';
import VendorPortalRoutes from './routes/VendorPortalRoutes';
import Login from './pages/Login';

function ProtectedRoute({ children }: { children: JSX.Element }) {
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);
  if (!isAuthenticated) return <Navigate to="/login" />;
  return children;
}

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <Suspense fallback={<DashboardSkeleton />}>
          {/* Global Search and Commands palette overlay */}
          <CommandPalette />
          
          <Routes>
            <Route path="/login" element={<Login />} />
            
            {/* Vendor Portal (Isolated layout) */}
            <Route path="/portal/*" element={<VendorPortalRoutes />} />
            
            {/* Desktop Shell Workspace Wildcard Route */}
            <Route path="/*" element={<ProtectedRoute><MainLayout /></ProtectedRoute>} />
          </Routes>
        </Suspense>
      </Router>
      <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
    </ErrorBoundary>
  );
}

export default App;
