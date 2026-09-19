import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api.js';
import { Auction } from '../types/index.js';
import { getSocket } from '../services/socket.js';
import { CountdownTimer } from '../components/common/CountdownTimer.js';
import {
  Search,
  Filter,
  ArrowUpDown,
  Gavel,
  Clock,
  Sparkles,
  Zap,
  ArrowRight,
} from 'lucide-react';

const CATEGORIES = ['All', 'Computing', 'Photography', 'Watches', 'Electronics', 'Benchmark', 'Collectibles'];

export const MarketplacePage: React.FC = () => {
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [status, setStatus] = useState('active');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('DESC');

  const fetchAuctions = async () => {
    try {
      setLoading(true);
      const res = await api.getAuctions({
        category: category === 'All' ? undefined : category,
        status: status === 'all' ? undefined : status,
        search: search.trim() || undefined,
        sortBy,
        sortOrder,
      });
      setAuctions(res.auctions);
    } catch (err) {
      console.error('[MARKETPLACE] Failed to fetch auctions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuctions();
  }, [category, status, sortBy, sortOrder]);

  // Real-time socket listener for auction updates
  useEffect(() => {
    const socket = getSocket();
    const handleAuctionUpdate = (data: {
      auctionId: string;
      currentHighestBid: number;
      bidCount: number;
      latestBidderName?: string;
    }) => {
      setAuctions((prev) =>
        prev.map((a) => {
          if (a.id === data.auctionId) {
            const minNextBid = parseFloat((data.currentHighestBid + a.minimumIncrement).toFixed(2));
            return {
              ...a,
              currentHighestBid: data.currentHighestBid,
              bidCount: data.bidCount,
              minNextBid,
            };
          }
          return a;
        })
      );
    };

    socket.on('auction:updated', handleAuctionUpdate);
    return () => {
      socket.off('auction:updated', handleAuctionUpdate);
    };
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchAuctions();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-2.5">
            <span>Auction Marketplace</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-mono bg-brand-500/10 text-brand-400 border border-brand-500/20">
              Live Bidding
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Discover real-time verified items with PostgreSQL row-lock protection
          </p>
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 max-w-md w-full">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search auctions by title or keywords..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-navy-900 border border-slate-700 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-brand-500"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition-colors"
          >
            Search
          </button>
        </form>
      </div>

      {/* Filter and Sorting Controls */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 sm:pb-0 w-full lg:w-auto scrollbar-none">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                category === cat
                  ? 'bg-brand-500 text-white shadow-sm shadow-brand-500/30'
                  : 'bg-navy-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Secondary Filters */}
        <div className="flex items-center gap-3 w-full lg:w-auto justify-between lg:justify-end">
          {/* Status Tabs */}
          <div className="flex bg-navy-900 p-1 rounded-lg border border-slate-800 text-xs">
            <button
              onClick={() => setStatus('active')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                status === 'active' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Active
            </button>
            <button
              onClick={() => setStatus('ended')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                status === 'ended' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Ended
            </button>
            <button
              onClick={() => setStatus('all')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                status === 'all' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All
            </button>
          </div>

          {/* Sort Dropdown */}
          <div className="flex items-center gap-1.5 bg-navy-900 px-3 py-1.5 rounded-lg border border-slate-800 text-xs text-slate-300">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [sb, so] = e.target.value.split('-');
                setSortBy(sb);
                setSortOrder(so);
              }}
              className="bg-transparent text-xs text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value="created_at-DESC">Latest Added</option>
              <option value="current_highest_bid-DESC">Price: High to Low</option>
              <option value="current_highest_bid-ASC">Price: Low to High</option>
              <option value="end_time-ASC">Ending Soonest</option>
            </select>
          </div>
        </div>
      </div>

      {/* Auction Cards Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-navy-900/50 border border-slate-800 rounded-2xl h-96 animate-pulse" />
          ))}
        </div>
      ) : auctions.length === 0 ? (
        <div className="text-center py-16 bg-navy-900/40 border border-slate-800/80 rounded-2xl">
          <Gavel className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-white">No auctions found</h3>
          <p className="text-xs text-slate-400 mt-1">
            Try adjusting your search criteria or switching category filters
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {auctions.map((auction) => {
            const isEnded = auction.status === 'ended';

            return (
              <div
                key={auction.id}
                className="bg-navy-900 border border-slate-800 rounded-2xl overflow-hidden hover:border-slate-700 transition-all hover:shadow-xl flex flex-col group relative"
              >
                {/* Image Container */}
                <div className="relative h-52 bg-slate-900 overflow-hidden">
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

                  {/* Badges */}
                  <div className="absolute top-3 left-3 flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-full text-xs font-mono font-medium bg-navy-900/90 backdrop-blur-md border border-slate-700 text-slate-200 shadow-sm">
                      {auction.category}
                    </span>
                    {auction.category === 'Benchmark' && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                        <Zap className="w-3 h-3 fill-amber-300" />
                        LAB
                      </span>
                    )}
                  </div>

                  <div className="absolute top-3 right-3">
                    <CountdownTimer endTime={auction.endTime} compact />
                  </div>

                  {isEnded && (
                    <div className="absolute inset-0 bg-navy-950/80 backdrop-blur-[2px] flex items-center justify-center">
                      <div className="text-center p-4">
                        <span className="text-xs uppercase font-mono font-bold tracking-widest text-rose-400 bg-rose-950/80 border border-rose-500/40 px-3 py-1 rounded-full block mb-2">
                          AUCTION CONCLUDED
                        </span>
                        {auction.winnerName && (
                          <p className="text-xs text-slate-300">
                            Won by <span className="text-white font-semibold">{auction.winnerName}</span> for{' '}
                            <span className="text-accent-emerald font-mono font-bold">
                              ${auction.winningBid?.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </span>
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="font-semibold text-base text-white line-clamp-1 group-hover:text-brand-400 transition-colors">
                      {auction.title}
                    </h3>
                    <p className="text-xs text-slate-400 mt-1.5 line-clamp-2 leading-relaxed">
                      {auction.description}
                    </p>
                  </div>

                  <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-end justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase tracking-wider text-slate-400 block font-mono">
                          {isEnded ? 'Final Winning Bid' : 'Current Highest Bid'}
                        </span>
                        <span className="text-[10px] font-mono text-brand-400 bg-brand-500/10 px-1.5 py-0.5 rounded">
                          v{auction.version}
                        </span>
                      </div>
                      <span className="text-2xl font-bold font-mono text-accent-cyan tracking-tight block mt-0.5">
                        ${auction.currentHighestBid.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                      <div className="flex items-center gap-3 text-[11px] text-slate-400 font-mono mt-1">
                        <span>{auction.bidCount} {auction.bidCount === 1 ? 'bid' : 'bids'}</span>
                        <span>•</span>
                        <span>Min +${auction.minimumIncrement.toFixed(2)}</span>
                      </div>
                    </div>

                    <Link
                      to={`/auctions/${auction.id}`}
                      className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-brand-500 hover:bg-brand-400 text-white transition-all shadow-sm shadow-brand-500/30 flex items-center gap-1.5 group-hover:translate-x-0.5"
                    >
                      <span>{isEnded ? 'View Results' : 'Bid Now'}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
