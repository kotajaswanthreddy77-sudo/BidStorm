import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.js';
import { Navbar } from './components/layout/Navbar.js';
import { Footer } from './components/layout/Footer.js';

import { LandingPage } from './pages/LandingPage.js';
import { LoginPage } from './pages/LoginPage.js';
import { RegisterPage } from './pages/RegisterPage.js';
import { MarketplacePage } from './pages/MarketplacePage.js';
import { AuctionDetailPage } from './pages/AuctionDetailPage.js';
import { BuyerDashboard } from './pages/BuyerDashboard.js';
import { ManagerDashboard } from './pages/ManagerDashboard.js';
import { AdminDashboard } from './pages/AdminDashboard.js';
import { ConcurrencyLab } from './pages/ConcurrencyLab.js';

// Protected Route Guard
interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: Array<'buyer' | 'manager' | 'admin'>;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { user, isLoading, isAuthenticated, demoLogin } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-xs font-mono text-slate-500">
        Authenticating...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return (
      <div className="max-w-md mx-auto my-20 p-8 bg-navy-900 border border-slate-800 rounded-2xl text-center space-y-4">
        <h3 className="text-lg font-bold text-white">Access Restricted</h3>
        <p className="text-xs text-slate-400">
          This page requires one of the following roles: <strong className="text-slate-200">{allowedRoles.join(', ')}</strong>.
          Your current persona is <strong className="text-brand-400 capitalize">{user.role}</strong>.
        </p>
        <div className="pt-2 flex justify-center gap-2">
          {allowedRoles.includes('admin') && (
            <button
              onClick={() => demoLogin('admin')}
              className="px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-medium"
            >
              Switch to Admin Demo
            </button>
          )}
          {allowedRoles.includes('manager') && (
            <button
              onClick={() => demoLogin('manager')}
              className="px-3 py-1.5 rounded-lg bg-purple-500/20 text-purple-300 border border-purple-500/40 text-xs font-medium"
            >
              Switch to Manager Demo
            </button>
          )}
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen flex flex-col bg-navy-950 text-slate-100 selection:bg-brand-500 selection:text-white">
          <Navbar />
          <main className="flex-1">
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<LandingPage />} />
              <Route path="/marketplace" element={<MarketplacePage />} />
              <Route path="/auctions/:id" element={<AuctionDetailPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />

              {/* Protected Persona Routes */}
              <Route
                path="/buyer"
                element={
                  <ProtectedRoute allowedRoles={['buyer', 'manager', 'admin']}>
                    <BuyerDashboard />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/manager"
                element={
                  <ProtectedRoute allowedRoles={['manager', 'admin']}>
                    <ManagerDashboard />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/admin"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <AdminDashboard />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/concurrency-lab"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <ConcurrencyLab />
                  </ProtectedRoute>
                }
              />

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
          <Footer />
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
