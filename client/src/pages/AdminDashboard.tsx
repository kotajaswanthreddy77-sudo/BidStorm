import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api.js';
import { SystemMetrics } from '../types/index.js';
import { MetricCard } from '../components/common/MetricCard.js';
import { joinAdminRoom, getSocket } from '../services/socket.js';
import {
  Activity,
  Gavel,
  ShieldAlert,
  Clock,
  Radio,
  Layers,
  Database,
  CheckCircle2,
  AlertTriangle,
  Zap,
  RefreshCw,
  Cpu,
} from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTelemetry = async () => {
    try {
      const [m, e] = await Promise.all([api.getMetrics(), api.getEvents()]);
      setMetrics(m);
      setEvents(e.events);
    } catch (err) {
      console.error('[ADMIN] Telemetry error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTelemetry();
    joinAdminRoom();

    const interval = setInterval(fetchTelemetry, 3000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !metrics) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center text-xs font-mono text-slate-500 animate-pulse">
        Connecting to PostgreSQL telemetry engine...
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
            <span>System Telemetry & Health</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-mono bg-accent-cyan/15 text-accent-cyan border border-accent-cyan/30">
              Live Database Monitor
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Real-time transaction percentiles, row-locking conflicts, throughput, and audit event logs
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchTelemetry}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
            title="Refresh metrics now"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <Link
            to="/concurrency-lab"
            className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 transition-all flex items-center gap-2"
          >
            <Zap className="w-4 h-4 text-accent-amber" />
            <span>Open Concurrency Lab</span>
          </Link>
        </div>
      </div>

      {/* Primary KPI Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <MetricCard
          title="Total Bids Logged"
          value={metrics?.totalBids.toLocaleString() || '0'}
          subtext={`${metrics?.acceptedBids || 0} accepted / ${metrics?.rejectedBids || 0} rejected`}
          icon={Gavel}
          variant="brand"
        />
        <MetricCard
          title="Acceptance Rate"
          value={`${metrics?.acceptanceRate || 100}%`}
          subtext="Valid vs outbid ratio"
          icon={CheckCircle2}
          variant="emerald"
        />
        <MetricCard
          title="Throughput (RPS)"
          value={`${metrics?.throughputRps || 0} req/s`}
          subtext="Current instantaneous request rate"
          icon={Activity}
          variant="cyan"
          trend="Instantaneous"
        />
        <MetricCard
          title="Active WS Sockets"
          value={metrics?.activeWebSocketConnections || 0}
          subtext="Connected browser tabs"
          icon={Radio}
          variant="amber"
        />
      </div>

      {/* Latency Percentiles & Engine Health */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Latency SLAs */}
        <div className="bg-navy-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-brand-400" />
              <span>Bid Latency Percentiles</span>
            </h3>
            <span className="text-[10px] font-mono text-slate-500">PostgreSQL tx window</span>
          </div>

          <div className="space-y-3 font-mono text-xs">
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-800/40 border border-slate-800">
              <span className="text-slate-400">p50 (Median)</span>
              <span className="font-bold text-white">{metrics?.p50ResponseTimeMs} ms</span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-800/40 border border-slate-800">
              <span className="text-slate-400">p95 Percentile</span>
              <span className="font-bold text-accent-cyan">{metrics?.p95ResponseTimeMs} ms</span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-800/40 border border-slate-800">
              <span className="text-slate-400">p99 Percentile</span>
              <span className="font-bold text-accent-amber">{metrics?.p99ResponseTimeMs} ms</span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-800/40 border border-slate-800">
              <span className="text-slate-400">Average Duration</span>
              <span className="font-bold text-white">{metrics?.averageResponseTimeMs} ms</span>
            </div>
          </div>
        </div>

        {/* Database & Concurrency Protection */}
        <div className="bg-navy-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm text-white flex items-center gap-2">
              <Database className="w-4 h-4 text-accent-cyan" />
              <span>Engine Invariant Health</span>
            </h3>
            <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Optimal
            </span>
          </div>

          <div className="space-y-3 font-mono text-xs">
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-800/40 border border-slate-800">
              <span className="text-slate-400">Database Errors</span>
              <span className="font-bold text-emerald-400">{metrics?.databaseErrors || 0}</span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-800/40 border border-slate-800">
              <span className="text-slate-400">Lock Conflicts Handled</span>
              <span className="font-bold text-accent-amber">{metrics?.databaseConflicts || 0}</span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-800/40 border border-slate-800">
              <span className="text-slate-400">Active Auctions</span>
              <span className="font-bold text-white">{metrics?.activeAuctions || 0}</span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-800/40 border border-slate-800">
              <span className="text-slate-400">Total Registered Users</span>
              <span className="font-bold text-white">{metrics?.totalUsers || 0}</span>
            </div>
          </div>
        </div>

        {/* Distributed Architecture Notice */}
        <div className="bg-navy-900 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-brand-400 uppercase tracking-wider mb-2">
              <Cpu className="w-4 h-4" />
              <span>Concurrency Guarantee</span>
            </div>
            <h4 className="font-bold text-white text-sm">Strict Row-Locking Enforced</h4>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Every bid placement acquires a transaction-level exclusive lock on the target auction row in PostgreSQL. Stale reads and phantom increments are mathematically eliminated.
            </p>
          </div>

          <div className="pt-4 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-500 font-mono">
            <span>Isolation: READ COMMITTED + FOR UPDATE</span>
            <span className="text-emerald-400">100% Invariant Safe</span>
          </div>
        </div>
      </div>

      {/* System Audit Events Stream */}
      <div className="bg-navy-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-accent-cyan" />
              <span>Recent Transactional Audit Events</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Live immutable stream recorded in <code className="text-brand-300">auction_events</code> table
            </p>
          </div>
          <span className="text-xs font-mono text-slate-400 bg-slate-800 px-3 py-1 rounded-full">
            {events.length} events retrieved
          </span>
        </div>

        {events.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-xs font-mono">
            No audit events found. Place bids or run simulations to generate events.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-[10px] uppercase font-mono tracking-wider text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Event Type</th>
                  <th className="py-3 px-4">Auction</th>
                  <th className="py-3 px-4">Payload Snapshot</th>
                  <th className="py-3 px-4">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {events.map((ev) => (
                  <tr key={ev.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-brand-500/15 text-brand-300 border border-brand-500/30">
                        {ev.event_type}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-sans font-medium text-white max-w-xs truncate">
                      {ev.auction_title || ev.auction_id?.slice(0, 8)}
                    </td>
                    <td className="py-3 px-4 text-slate-300 max-w-md truncate">
                      {typeof ev.payload === 'object' ? JSON.stringify(ev.payload) : ev.payload}
                    </td>
                    <td className="py-3 px-4 text-slate-400 text-[11px]">
                      {new Date(ev.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
