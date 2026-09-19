import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api.js';
import { Bid } from '../types/index.js';
import { useAuth } from '../context/AuthContext.js';
import { MetricCard } from '../components/common/MetricCard.js';
import {
  Gavel,
  CheckCircle2,
  AlertCircle,
  Trophy,
  ArrowRight,
  TrendingUp,
  Clock,
} from 'lucide-react';

export const BuyerDashboard: React.FC = () => {
  const { user } = useAuth();
  const [bids, setBids] = useState<Bid[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getUserBids()
      .then((res) => setBids(res.bids))
      .catch((err) => console.error('[BUYER] Fetch error:', err))
      .finally(() => setLoading(false));
  }, []);

  const totalBids = bids.length;
  const acceptedBids = bids.filter((b) => b.status === 'accepted').length;
  const rejectedBids = bids.filter((b) => b.status === 'rejected').length;
  const acceptanceRate = totalBids > 0 ? ((acceptedBids / totalBids) * 100).toFixed(0) : '100';

  // Distinct auctions participated in
  const uniqueAuctions = new Set(bids.map((b) => b.auctionId)).size;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
          <span>Buyer Activity & Portfolio</span>
          <span className="text-xs px-2.5 py-0.5 rounded-full font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20">
            {user?.name}
          </span>
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Monitor your active submissions, personal win rate, and audit history
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <MetricCard
          title="Total Bids Placed"
          value={totalBids}
          subtext={`Across ${uniqueAuctions} distinct auctions`}
          icon={Gavel}
          variant="brand"
        />
        <MetricCard
          title="Accepted Bids"
          value={acceptedBids}
          subtext="Valid highest bids committed"
          icon={CheckCircle2}
          variant="emerald"
        />
        <MetricCard
          title="Outbid / Rejected"
          value={rejectedBids}
          subtext="Safely rejected under-bids"
          icon={AlertCircle}
          variant="rose"
        />
        <MetricCard
          title="Success Rate"
          value={`${acceptanceRate}%`}
          subtext="Submission acceptance ratio"
          icon={Trophy}
          variant="amber"
        />
      </div>

      {/* Bidding History Table */}
      <div className="bg-navy-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-brand-400" />
              <span>Personal Bidding Log</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Every bid submitted from your account with real-time outcome
            </p>
          </div>
          <Link
            to="/marketplace"
            className="text-xs font-semibold text-brand-400 hover:text-brand-300 flex items-center gap-1"
          >
            <span>Browse Active Auctions</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {loading ? (
          <div className="py-12 text-center text-slate-500 text-xs font-mono">
            Loading your bids history...
          </div>
        ) : bids.length === 0 ? (
          <div className="py-16 text-center bg-navy-950/40 rounded-2xl border border-slate-800/60">
            <Gavel className="w-10 h-10 text-slate-600 mx-auto mb-2" />
            <p className="text-sm text-slate-300 font-semibold">No bids placed yet</p>
            <p className="text-xs text-slate-500 mt-1">Explore auctions to place your first transactional bid!</p>
            <Link
              to="/marketplace"
              className="mt-4 inline-block px-4 py-2 rounded-xl text-xs font-semibold bg-brand-500 hover:bg-brand-400 text-white transition-colors"
            >
              Explore Marketplace
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-[10px] uppercase font-mono tracking-wider text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Auction</th>
                  <th className="py-3 px-4">Your Bid</th>
                  <th className="py-3 px-4">Current Highest</th>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Note</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {bids.map((bid) => (
                  <tr key={bid.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-4">
                      {bid.status === 'accepted' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                          <CheckCircle2 className="w-3 h-3" />
                          Accepted
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30">
                          <AlertCircle className="w-3 h-3" />
                          Rejected
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-sans font-medium text-white max-w-xs truncate">
                      {bid.auctionTitle || 'Auction Item'}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-200">
                      ${bid.amount.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-accent-cyan font-bold">
                      ${bid.currentHighestBid?.toFixed(2) || '—'}
                    </td>
                    <td className="py-3 px-4 text-slate-400 text-[11px]">
                      {new Date(bid.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="py-3 px-4 font-sans text-slate-400 text-xs truncate max-w-xs">
                      {bid.rejectionReason || 'Accepted on-chain/DB'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Link
                        to={`/auctions/${bid.auctionId}`}
                        className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors inline-block font-sans"
                      >
                        View
                      </Link>
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
