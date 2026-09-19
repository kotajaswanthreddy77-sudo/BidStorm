import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.js';
import { subscribeConnectionStatus } from '../../services/socket.js';
import {
  Gavel,
  Zap,
  Shield,
  Activity,
  Layers,
  User as UserIcon,
  LogOut,
  ChevronDown,
  Sparkles,
  Server,
} from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, logout, demoLogin, isAuthenticated } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [showDemoDropdown, setShowDemoDropdown] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    return subscribeConnectionStatus((connected) => {
      setIsConnected(connected);
    });
  }, []);

  const handleDemoSwitch = async (role: 'buyer' | 'manager' | 'admin') => {
    setShowDemoDropdown(false);
    await demoLogin(role);
    if (role === 'admin') navigate('/admin');
    else if (role === 'manager') navigate('/manager');
    else navigate('/marketplace');
  };

  return (
    <nav className="sticky top-0 z-50 bg-navy-900/90 backdrop-blur-md border-b border-slate-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center space-x-6">
            <Link to="/" className="flex items-center space-x-3 group">
              <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 via-brand-500 to-accent-cyan shadow-lg shadow-brand-500/20 group-hover:scale-105 transition-transform">
                <Gavel className="w-5 h-5 text-white transform -rotate-12" />
                <Zap className="w-3.5 h-3.5 text-accent-cyan absolute -top-1 -right-1 fill-accent-cyan" />
              </div>
              <div className="flex flex-col">
                <span className="text-xl font-bold tracking-tight text-white flex items-center gap-1.5">
                  Bid<span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-400 to-accent-cyan">Storm</span>
                </span>
                <span className="text-[10px] tracking-widest text-slate-400 font-mono uppercase -mt-1">
                  Safe Load Engine
                </span>
              </div>
            </Link>

            {/* Navigation links */}
            <div className="hidden md:flex items-center space-x-1">
              <Link
                to="/marketplace"
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  location.pathname === '/marketplace'
                    ? 'text-brand-400 bg-brand-500/10'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                Marketplace
              </Link>

              {user?.role === 'buyer' && (
                <Link
                  to="/buyer"
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    location.pathname === '/buyer'
                      ? 'text-brand-400 bg-brand-500/10'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
                  }`}
                >
                  My Bids
                </Link>
              )}

              {(user?.role === 'manager' || user?.role === 'admin') && (
                <Link
                  to="/manager"
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    location.pathname === '/manager'
                      ? 'text-brand-400 bg-brand-500/10'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
                  }`}
                >
                  Manage Auctions
                </Link>
              )}

              {user?.role === 'admin' && (
                <>
                  <Link
                    to="/admin"
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                      location.pathname === '/admin'
                        ? 'text-brand-400 bg-brand-500/10'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
                    }`}
                  >
                    <Activity className="w-4 h-4 text-accent-cyan" />
                    Admin Telemetry
                  </Link>

                  <Link
                    to="/concurrency-lab"
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                      location.pathname === '/concurrency-lab'
                        ? 'text-accent-amber bg-amber-500/10 border border-amber-500/30'
                        : 'text-amber-400 hover:text-amber-300 hover:bg-amber-500/10'
                    }`}
                  >
                    <Zap className="w-4 h-4 text-accent-amber" />
                    Concurrency Lab
                  </Link>
                </>
              )}
            </div>
          </div>

          {/* Right Controls */}
          <div className="flex items-center space-x-3">
            {/* Live Socket Connection Badge */}
            <div
              className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-mono border ${
                isConnected
                  ? 'bg-emerald-950/40 text-emerald-400 border-emerald-500/30'
                  : 'bg-rose-950/40 text-rose-400 border-rose-500/30'
              }`}
              title={isConnected ? 'Connected to Real-Time Socket Server' : 'Disconnected from Socket Server'}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'
                }`}
              />
              <span className="hidden sm:inline">{isConnected ? 'LIVE WS' : 'OFFLINE'}</span>
            </div>

            {/* Quick Demo Switcher Dropdown (Essential for Hackathon Demo) */}
            <div className="relative">
              <button
                onClick={() => setShowDemoDropdown(!showDemoDropdown)}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors shadow-sm"
              >
                <Sparkles className="w-3.5 h-3.5 text-accent-cyan" />
                <span className="hidden sm:inline">Demo Roles</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {showDemoDropdown && (
                <div className="absolute right-0 mt-2 w-52 rounded-xl bg-navy-850 border border-slate-700 shadow-xl py-1 z-50 animate-in fade-in zoom-in-95">
                  <div className="px-3 py-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                    Switch Test Persona
                  </div>
                  <button
                    onClick={() => handleDemoSwitch('buyer')}
                    className="w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-800/80 text-slate-200 transition-colors"
                  >
                    <span>Buyer (Alice)</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 font-mono">
                      buyer
                    </span>
                  </button>
                  <button
                    onClick={() => handleDemoSwitch('manager')}
                    className="w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-800/80 text-slate-200 transition-colors"
                  >
                    <span>Manager (Marcus)</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-mono">
                      manager
                    </span>
                  </button>
                  <button
                    onClick={() => handleDemoSwitch('admin')}
                    className="w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-800/80 text-slate-200 transition-colors"
                  >
                    <span>Admin (Sarah)</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono">
                      admin
                    </span>
                  </button>
                </div>
              )}
            </div>

            {/* User Profile / Auth Actions */}
            {isAuthenticated ? (
              <div className="flex items-center space-x-2">
                <div className="hidden lg:flex flex-col text-right">
                  <span className="text-xs font-semibold text-white">{user?.name}</span>
                  <span className="text-[10px] font-mono text-brand-400 capitalize">{user?.role}</span>
                </div>
                <button
                  onClick={logout}
                  title="Log out"
                  className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800/50 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <Link
                  to="/login"
                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-200 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  Log In
                </Link>
                <Link
                  to="/register"
                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-brand-500 hover:bg-brand-400 text-white transition-colors shadow-sm shadow-brand-500/30"
                >
                  Register
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};
