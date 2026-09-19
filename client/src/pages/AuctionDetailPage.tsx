import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../services/api.js';
import { Auction, Bid } from '../types/index.js';
import { useAuth } from '../context/AuthContext.js';
import { getSocket, joinAuctionRoom, leaveAuctionRoom } from '../services/socket.js';
import { CountdownTimer } from '../components/common/CountdownTimer.js';
import {
  Gavel,
  ShieldCheck,
  Clock,
  Zap,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Lock,
  RefreshCw,
  User as UserIcon,
  Sparkles,
  Layers,
} from 'lucide-react';

export const AuctionDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user, isAuthenticated, demoLogin } = useAuth();

  const [auction, setAuction] = useState<Auction | null>(null);
  const [bids, setBids] = useState<Bid[]>([]);
  const [loading, setLoading] = useState(true);
  const [bidAmount, setBidAmount] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
    details?: any;
  } | null>(null);
  const [liveActivity, setLiveActivity] = useState<Array<{
    id: string;
    amount: number;
    bidderName: string;
    timestamp: string;
  }>>([]);
  const [priceFlash, setPriceFlash] = useState(false);

  const fetchAuctionData = async () => {
    if (!id) return;
    try {
      const [auctionData, bidsData] = await Promise.all([
        api.getAuction(id),
        api.getAuctionBids(id),
      ]);
      setAuction(auctionData.auction);
      setBids(bidsData.bids);
      // Pre-fill next valid bid
      setBidAmount(auctionData.auction.minNextBid.toString());
    } catch (err: any) {
      console.error('[AUCTION DETAIL] Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuctionData();
  }, [id]);

  // Real-time socket room subscription
  useEffect(() => {
    if (!id) return;
    joinAuctionRoom(id);

    const socket = getSocket();

    const handleAuctionUpdated = (data: {
      auctionId: string;
      currentHighestBid: number;
      bidCount: number;
      latestBidderName?: string;
      timestamp: string;
    }) => {
      if (data.auctionId !== id) return;

      setPriceFlash(true);
      setTimeout(() => setPriceFlash(false), 1200);

      setAuction((prev) => {
        if (!prev) return null;
        const minNextBid = parseFloat((data.currentHighestBid + prev.minimumIncrement).toFixed(2));
        return {
          ...prev,
          currentHighestBid: data.currentHighestBid,
          bidCount: data.bidCount,
          minNextBid,
          version: prev.version + 1,
          updatedAt: data.timestamp,
        };
      });

      // Refetch full bids list to ensure accurate sync
      api.getAuctionBids(id).then((bRes) => setBids(bRes.bids)).catch(() => {});
    };

    const handleBidAccepted = (data: {
      auctionId: string;
      bidId: string;
      amount: number;
      bidderName?: string;
      timestamp: string;
    }) => {
      if (data.auctionId !== id) return;
      setLiveActivity((prev) => [
        {
          id: data.bidId,
          amount: data.amount,
          bidderName: data.bidderName || 'Anonymous Bidder',
          timestamp: data.timestamp,
        },
        ...prev.slice(0, 9),
      ]);
    };

    socket.on('auction:updated', handleAuctionUpdated);
    socket.on('bid:accepted', handleBidAccepted);

    return () => {
      leaveAuctionRoom(id);
      socket.off('auction:updated', handleAuctionUpdated);
      socket.off('bid:accepted', handleBidAccepted);
    };
  }, [id]);

  const handlePlaceBid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auction || !id || isSubmitting) return;

    const amount = parseFloat(bidAmount);
    if (isNaN(amount) || amount <= 0) {
      setFeedback({ type: 'error', message: 'Please enter a valid positive numerical bid amount.' });
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);

    // Generate unique idempotency key for this submission attempt
    const idempotencyKey = `bid-${id}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    try {
      const res = await api.placeBid(id, amount, idempotencyKey);
      setFeedback({
        type: 'success',
        message: `Bid of $${amount.toFixed(2)} accepted! You are currently the highest bidder.`,
        details: res.result,
      });

      // Advance input field to next required bid
      if (auction) {
        const nextTarget = parseFloat((amount + auction.minimumIncrement).toFixed(2));
        setBidAmount(nextTarget.toString());
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Bid submission failed',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickAdd = (increment: number) => {
    if (!auction) return;
    const currentBase = auction.currentHighestBid || auction.startingPrice;
    const nextAmount = parseFloat((currentBase + increment).toFixed(2));
    setBidAmount(nextAmount.toString());
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 animate-pulse">
          <div className="h-[450px] bg-navy-900 rounded-2xl" />
          <div className="space-y-6">
            <div className="h-10 bg-navy-900 rounded-lg w-3/4" />
            <div className="h-32 bg-navy-900 rounded-xl" />
            <div className="h-48 bg-navy-900 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!auction) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
        <h2 className="text-2xl font-bold text-white">Auction Not Found</h2>
        <p className="text-slate-400 text-sm mt-1">The auction ID may be invalid or expired.</p>
        <Link to="/marketplace" className="mt-4 inline-block text-brand-400 text-sm hover:underline">
          Return to Marketplace
        </Link>
      </div>
    );
  }

  const isEnded = auction.status === 'ended';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
      {/* Breadcrumbs & Live Indicator */}
      <div className="flex items-center justify-between text-xs text-slate-400 border-b border-slate-800/80 pb-4">
        <div className="flex items-center space-x-2">
          <Link to="/marketplace" className="hover:text-white transition-colors">Marketplace</Link>
          <span>/</span>
          <span className="text-slate-200">{auction.category}</span>
          <span>/</span>
          <span className="text-brand-400 font-mono text-[11px] truncate max-w-xs">{auction.title}</span>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={fetchAuctionData}
            title="Refresh latest state"
            className="flex items-center gap-1 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Sync</span>
          </button>
          <span className="font-mono text-[11px] bg-slate-800 px-2 py-0.5 rounded text-slate-300">
            Row Lock Ver: v{auction.version}
          </span>
        </div>
      </div>

      {/* Main Grid: Left Item Showcase, Right Bidding Terminal */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Left Column: Product Showcase */}
        <div className="lg:col-span-7 space-y-6">
          <div className="relative rounded-3xl overflow-hidden bg-navy-900 border border-slate-800 shadow-2xl group">
            <div className="aspect-[4/3] w-full overflow-hidden bg-slate-900 flex items-center justify-center">
              {auction.imageUrl ? (
                <img
                  src={auction.imageUrl}
                  alt={auction.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                />
              ) : (
                <Gavel className="w-20 h-20 text-slate-600" />
              )}
            </div>

            {/* Status & Category Overlays */}
            <div className="absolute top-4 left-4 flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-mono font-medium bg-navy-950/80 backdrop-blur-md border border-slate-700 text-white shadow-md">
                {auction.category}
              </span>
              <span
                className={`px-3 py-1 rounded-full text-xs font-mono font-medium border ${
                  auction.status === 'active'
                    ? 'bg-emerald-950/80 text-emerald-400 border-emerald-500/40'
                    : 'bg-rose-950/80 text-rose-400 border-rose-500/40'
                }`}
              >
                {auction.status.toUpperCase()}
              </span>
            </div>

            {/* Countdown Floating Card */}
            <div className="absolute bottom-4 left-4 right-4 bg-navy-950/85 backdrop-blur-md border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 block">
                  Time Remaining
                </span>
                <span className="text-xs text-slate-300">Closes {new Date(auction.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <CountdownTimer endTime={auction.endTime} onEnd={fetchAuctionData} />
            </div>
          </div>

          {/* Description & Technical Guarantees */}
          <div className="bg-navy-900 border border-slate-800 rounded-2xl p-6 space-y-4">
            <h2 className="text-xl font-bold text-white tracking-tight">{auction.title}</h2>
            <p className="text-sm text-slate-300 leading-relaxed">{auction.description}</p>

            <div className="pt-4 border-t border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div>
                <span className="text-slate-500 block uppercase text-[10px] font-mono">Starting Price</span>
                <span className="text-slate-200 font-mono font-semibold">${auction.startingPrice.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-slate-500 block uppercase text-[10px] font-mono">Min Increment</span>
                <span className="text-slate-200 font-mono font-semibold">+${auction.minimumIncrement.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-slate-500 block uppercase text-[10px] font-mono">Creator</span>
                <span className="text-slate-200 truncate block">{auction.creatorName || 'Manager'}</span>
              </div>
              <div>
                <span className="text-slate-500 block uppercase text-[10px] font-mono">Auction ID</span>
                <span className="text-slate-400 font-mono text-[10px] truncate block">{auction.id.slice(0, 8)}...</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Transactional Bidding Terminal */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-navy-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
            {/* Real-time Ticker Price Box */}
            <div
              className={`p-5 rounded-2xl border transition-all duration-500 ${
                priceFlash
                  ? 'bg-brand-500/25 border-brand-400 shadow-lg shadow-brand-500/30'
                  : 'bg-navy-950/90 border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-1">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  {isEnded ? 'Final Winning Bid' : 'Current Highest Bid'}
                </span>
                <span className="text-slate-500 font-mono text-[11px]">
                  {auction.bidCount} {auction.bidCount === 1 ? 'bid' : 'bids'} total
                </span>
              </div>

              <div className="text-4xl font-extrabold font-mono text-white tracking-tight flex items-baseline gap-2">
                <span className="text-accent-cyan">
                  ${auction.currentHighestBid.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
                <span className="text-xs font-normal text-slate-400 font-sans">USD</span>
              </div>

              {auction.highestBidInfo && (
                <div className="mt-2 text-xs text-slate-400 flex items-center justify-between">
                  <span>Held by: <strong className="text-slate-200">{auction.highestBidInfo.bidderName}</strong></span>
                  <span className="text-[10px] font-mono text-slate-500">
                    {new Date(auction.highestBidInfo.createdAt).toLocaleTimeString()}
                  </span>
                </div>
              )}
            </div>

            {/* Winner Banner if Ended */}
            {isEnded && (
              <div className="mt-5 p-4 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-200 text-xs">
                <div className="font-semibold text-sm flex items-center gap-1.5 mb-1">
                  <Sparkles className="w-4 h-4 text-accent-amber" />
                  <span>Auction Closed & Winner Settled</span>
                </div>
                {auction.winnerName ? (
                  <p>
                    Winning Bidder: <strong>{auction.winnerName}</strong> at ${auction.winningBid?.toFixed(2)}
                  </p>
                ) : (
                  <p>No valid bids were placed on this auction.</p>
                )}
              </div>
            )}

            {/* Bidding Terminal (If Active) */}
            {!isEnded && (
              <div className="mt-6 space-y-5">
                {/* Minimum next valid bid guidance */}
                <div className="flex items-center justify-between text-xs bg-slate-800/40 p-3 rounded-xl border border-slate-700/60">
                  <span className="text-slate-400">Next Minimum Valid Bid:</span>
                  <span className="font-mono font-bold text-accent-emerald text-sm">
                    ${auction.minNextBid.toFixed(2)}
                  </span>
                </div>

                {/* Quick Increment Buttons */}
                <div>
                  <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-2">
                    Quick Increment Shortcuts
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => handleQuickAdd(auction.minimumIncrement)}
                      className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-mono text-xs font-semibold transition-colors"
                    >
                      +${auction.minimumIncrement.toFixed(0)} (Min)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickAdd(50)}
                      className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-mono text-xs font-semibold transition-colors"
                    >
                      +$50.00
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickAdd(100)}
                      className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-mono text-xs font-semibold transition-colors"
                    >
                      +$100.00
                    </button>
                  </div>
                </div>

                {/* Place Bid Form */}
                <form onSubmit={handlePlaceBid} className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Your Bid Amount ($ USD)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-sm">
                        $
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        min={auction.minNextBid}
                        required
                        value={bidAmount}
                        onChange={(e) => setBidAmount(e.target.value)}
                        placeholder={auction.minNextBid.toFixed(2)}
                        className="w-full pl-8 pr-4 py-3 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono text-lg font-bold focus:outline-none focus:border-brand-500 transition-colors"
                      />
                    </div>
                  </div>

                  {/* Feedback Banner */}
                  {feedback && (
                    <div
                      className={`p-3.5 rounded-xl text-xs flex items-start gap-2.5 border animate-in fade-in ${
                        feedback.type === 'success'
                          ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                          : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
                      }`}
                    >
                      {feedback.type === 'success' ? (
                        <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
                      ) : (
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                      )}
                      <div>
                        <p className="font-semibold">{feedback.type === 'success' ? 'Bid Accepted' : 'Bid Rejected'}</p>
                        <p className="mt-0.5 text-[11px] leading-relaxed opacity-90">{feedback.message}</p>
                      </div>
                    </div>
                  )}

                  {/* Submit Button */}
                  {isAuthenticated ? (
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full py-3.5 px-4 rounded-xl font-bold text-sm bg-gradient-to-r from-brand-600 to-accent-cyan hover:from-brand-500 hover:to-accent-cyan text-white shadow-lg shadow-brand-500/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <Gavel className="w-4 h-4" />
                      <span>{isSubmitting ? 'Acquiring Row Lock & Bidding...' : 'Place Guaranteed Bid'}</span>
                    </button>
                  ) : (
                    <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700 text-center space-y-2">
                      <p className="text-xs text-slate-300">You must be logged in to submit bids.</p>
                      <button
                        type="button"
                        onClick={() => demoLogin('buyer')}
                        className="px-4 py-2 rounded-lg bg-brand-500 hover:bg-brand-400 text-white text-xs font-semibold transition-colors"
                      >
                        1-Click Log In as Buyer
                      </button>
                    </div>
                  )}
                </form>

                <div className="pt-3 flex items-center justify-between text-[11px] font-mono text-slate-400">
                  <span className="flex items-center gap-1">
                    <Lock className="w-3 h-3 text-accent-emerald" />
                    SELECT FOR UPDATE protected
                  </span>
                  <span>Idempotency guaranteed</span>
                </div>
              </div>
            )}
          </div>

          {/* Live Activity Feed */}
          {liveActivity.length > 0 && (
            <div className="bg-navy-900 border border-slate-800 rounded-2xl p-4 space-y-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                Live Broadcast Feed
              </span>
              <div className="space-y-1.5">
                {liveActivity.map((act) => (
                  <div
                    key={act.id}
                    className="text-xs p-2 rounded-lg bg-slate-800/50 flex items-center justify-between border border-slate-800 animate-in slide-in-from-top-1"
                  >
                    <span className="text-slate-200">
                      <strong>{act.bidderName}</strong> placed{' '}
                      <span className="text-emerald-400 font-mono font-bold">${act.amount.toFixed(2)}</span>
                    </span>
                    <span className="text-[10px] font-mono text-slate-500">
                      {new Date(act.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Full Bid History Table */}
      <div className="bg-navy-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-brand-400" />
              <span>Full Bid History & Audit Log</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Transparent log of accepted and rejected submissions for this auction
            </p>
          </div>
          <span className="text-xs font-mono text-slate-400 bg-slate-800 px-3 py-1 rounded-full">
            {bids.length} records recorded
          </span>
        </div>

        {bids.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-xs font-mono">
            No bids submitted yet for this auction. Be the first to bid!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-[10px] uppercase font-mono tracking-wider text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Bidder</th>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Rejection Reason / Note</th>
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
                    <td className="py-3 px-4 font-bold text-sm text-white">
                      ${bid.amount.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 font-sans text-slate-300">
                      {bid.bidderName || 'Anonymous'}
                    </td>
                    <td className="py-3 px-4 text-slate-400 text-[11px]">
                      {new Date(bid.createdAt).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 font-sans text-slate-400 text-xs">
                      {bid.rejectionReason || '—'}
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
