import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Gavel,
  Zap,
  ShieldCheck,
  Cpu,
  Database,
  ArrowRight,
  Lock,
  Layers,
  Sparkles,
  Activity,
  CheckCircle2,
} from 'lucide-react';
import { api } from '../services/api.js';
import { Auction } from '../types/index.js';
import { CountdownTimer } from '../components/common/CountdownTimer.js';
import { useAuth } from '../context/AuthContext.js';

export const LandingPage: React.FC = () => {
  const [featuredAuctions, setFeaturedAuctions] = useState<Auction[]>([]);
  const { demoLogin } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    api.getAuctions({ limit: 3, status: 'active' }).then((res) => {
      setFeaturedAuctions(res.auctions);
    }).catch(() => {});
  }, []);

  const handleStartDemo = async () => {
    await demoLogin('buyer');
    navigate('/marketplace');
  };

  return (
    <div className="space-y-24 py-10">
      {/* Hero Section */}
      <section className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center pt-8 pb-12 overflow-hidden">
        {/* Glow backdrop */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-gradient-to-tr from-brand-600/20 via-accent-cyan/15 to-transparent blur-3xl pointer-events-none rounded-full" />

        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/80 border border-slate-700/80 text-xs font-mono text-brand-300 mb-6 backdrop-blur-sm">
          <Zap className="w-3.5 h-3.5 text-accent-cyan" />
          <span>PostgreSQL Row-Locking & Concurrency Engine</span>
        </div>

        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white max-w-4xl mx-auto leading-tight">
          Real-Time Auction System{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-400 via-accent-cyan to-brand-300">
            Engineered Under Load
          </span>
        </h1>

        <p className="mt-6 text-base sm:text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed">
          Zero race conditions. Zero phantom bids. Zero double-winner allocations. BidStorm uses strict database transactions and row-level locks (<code className="text-brand-300 font-mono text-sm bg-slate-800 px-1.5 py-0.5 rounded">SELECT ... FOR UPDATE</code>) to guarantee transactional correctness even during extreme bid bursts.
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link
            to="/marketplace"
            className="px-6 py-3.5 rounded-xl font-semibold bg-brand-500 hover:bg-brand-400 text-white shadow-lg shadow-brand-500/25 transition-all flex items-center gap-2 group"
          >
            <span>Explore Live Auctions</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>

          <button
            onClick={handleStartDemo}
            className="px-6 py-3.5 rounded-xl font-semibold bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 transition-all flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4 text-accent-cyan" />
            <span>Launch 1-Click Demo</span>
          </button>

          <Link
            to="/concurrency-lab"
            className="px-6 py-3.5 rounded-xl font-semibold bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 transition-all flex items-center gap-2"
          >
            <Zap className="w-4 h-4 text-accent-amber" />
            <span>Concurrency Lab</span>
          </Link>
        </div>

        {/* Distributed guarantee badges */}
        <div className="mt-14 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto text-left">
          <div className="bg-navy-900/60 border border-slate-800 p-3.5 rounded-xl">
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
              <Lock className="w-4 h-4" />
              <span>Row-Level Locks</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Serialized bid updates prevent race conditions.</p>
          </div>

          <div className="bg-navy-900/60 border border-slate-800 p-3.5 rounded-xl">
            <div className="flex items-center gap-2 text-xs font-semibold text-cyan-400">
              <ShieldCheck className="w-4 h-4" />
              <span>Strict Idempotency</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">No duplicate requests accepted or double charged.</p>
          </div>

          <div className="bg-navy-900/60 border border-slate-800 p-3.5 rounded-xl">
            <div className="flex items-center gap-2 text-xs font-semibold text-brand-400">
              <Activity className="w-4 h-4" />
              <span>Sub-10ms Updates</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Broadcast over Socket.IO after commit.</p>
          </div>

          <div className="bg-navy-900/60 border border-slate-800 p-3.5 rounded-xl">
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-400">
              <Cpu className="w-4 h-4" />
              <span>Concurrency Lab</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Live stress tester with 7 invariant checks.</p>
          </div>
        </div>
      </section>

      {/* Featured Live Auctions */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <Gavel className="w-6 h-6 text-brand-400" />
              <span>Live Auction Highlights</span>
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              Real-time bids synced across connected clients via WebSockets.
            </p>
          </div>
          <Link
            to="/marketplace"
            className="text-sm font-medium text-brand-400 hover:text-brand-300 flex items-center gap-1 group"
          >
            <span>View All</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {featuredAuctions.map((auction) => (
            <div
              key={auction.id}
              className="bg-navy-900 border border-slate-800 rounded-2xl overflow-hidden hover:border-slate-700 transition-all hover:shadow-xl flex flex-col group"
            >
              {/* Image */}
              <div className="relative h-48 bg-slate-900 overflow-hidden">
                {auction.imageUrl ? (
                  <img
                    src={auction.imageUrl}
                    alt={auction.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-slate-800 text-slate-500">
                    <Gavel className="w-12 h-12" />
                  </div>
                )}
                <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-xs font-mono font-medium bg-navy-900/80 backdrop-blur-md border border-slate-700 text-slate-200">
                  {auction.category}
                </div>
                <div className="absolute top-3 right-3">
                  <CountdownTimer endTime={auction.endTime} compact />
                </div>
              </div>

              {/* Body */}
              <div className="p-5 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="font-semibold text-base text-white line-clamp-1 group-hover:text-brand-400 transition-colors">
                    {auction.title}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                    {auction.description}
                  </p>
                </div>

                <div className="mt-5 pt-4 border-t border-slate-800/80 flex items-end justify-between">
                  <div>
                    <span className="text-[11px] uppercase tracking-wider text-slate-400 block">
                      Current Bid
                    </span>
                    <span className="text-xl font-bold font-mono text-accent-cyan">
                      ${auction.currentHighestBid.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                    <span className="text-[10px] text-slate-500 block font-mono">
                      {auction.bidCount} {auction.bidCount === 1 ? 'bid' : 'bids'} placed
                    </span>
                  </div>

                  <Link
                    to={`/auctions/${auction.id}`}
                    className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-brand-500/15 hover:bg-brand-500 text-brand-300 hover:text-white border border-brand-500/30 transition-all flex items-center gap-1.5"
                  >
                    <span>Bid Now</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Deep-Dive: How Safe Concurrency Works */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-navy-900/80 border border-slate-800 rounded-3xl p-8 sm:p-12 relative overflow-hidden">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-500/10 border border-brand-500/20 text-xs font-mono text-brand-300 mb-4">
              <Lock className="w-3.5 h-3.5" />
              <span>Distributed Systems Architecture</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Why Naive Auction Engines Fail Under Load
            </h2>
            <p className="mt-3 text-slate-300 text-sm sm:text-base leading-relaxed">
              Standard web apps read the current highest bid into memory, compare it with the submitted amount, and execute an update. When 50 users submit bids within 10 milliseconds, all 50 read the old price, leading to race conditions, lost updates, and duplicate winning allocations.
            </p>
          </div>

          {/* Architecture comparison grid */}
          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Vulnerable Pattern */}
            <div className="bg-rose-950/20 border border-rose-500/20 rounded-2xl p-6">
              <span className="text-xs font-mono uppercase tracking-wider text-rose-400 font-semibold block mb-2">
                ❌ Vulnerable Architecture (Naive)
              </span>
              <ul className="space-y-2 text-xs text-slate-300">
                <li className="flex items-start gap-2">
                  <span className="text-rose-400 font-bold">•</span>
                  <span><strong>Unsafe Read:</strong> App reads current bid into memory without row lock.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-rose-400 font-bold">•</span>
                  <span><strong>Race Window:</strong> Multiple threads calculate next bid against stale price.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-rose-400 font-bold">•</span>
                  <span><strong>Early Broadcast:</strong> Emits WebSocket events before database commits.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-rose-400 font-bold">•</span>
                  <span><strong>Result:</strong> Discrepancies, duplicate accepted bids, race conditions.</span>
                </li>
              </ul>
            </div>

            {/* BidStorm Safe Pattern */}
            <div className="bg-emerald-950/20 border border-emerald-500/20 rounded-2xl p-6">
              <span className="text-xs font-mono uppercase tracking-wider text-emerald-400 font-semibold block mb-2">
                ✅ BidStorm Transactional Engine
              </span>
              <ul className="space-y-2 text-xs text-slate-300">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span><strong>SELECT ... FOR UPDATE:</strong> Locks the specific auction row in PostgreSQL.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span><strong>Sequential Invariant Verification:</strong> Validates strictly under the lock.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span><strong>Atomic Commit:</strong> Inserts bid, updates auction version, writes audit log.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span><strong>Post-Commit Emission:</strong> Only broadcasts to clients after SQL commit succeeds.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
