import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api.js';
import { Auction } from '../types/index.js';
import { useAuth } from '../context/AuthContext.js';
import {
  Plus,
  Gavel,
  Pause,
  Play,
  CheckCircle2,
  AlertCircle,
  Clock,
  Layers,
  Sparkles,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';

export const ManagerDashboard: React.FC = () => {
  const { user } = useAuth();
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // New auction form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Electronics');
  const [imageUrl, setImageUrl] = useState('');
  const [startingPrice, setStartingPrice] = useState('100');
  const [minimumIncrement, setMinimumIncrement] = useState('10');
  const [durationHours, setDurationHours] = useState('24');
  const [formError, setFormError] = useState<string | null>(null);

  const fetchManagedAuctions = async () => {
    try {
      setLoading(true);
      const res = await api.getAuctions({ limit: 50 });
      setAuctions(res.auctions);
    } catch (err) {
      console.error('[MANAGER] Failed to load auctions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchManagedAuctions();
  }, []);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const sPrice = parseFloat(startingPrice);
    const mInc = parseFloat(minimumIncrement);
    const dHours = parseFloat(durationHours);

    if (isNaN(sPrice) || sPrice <= 0 || isNaN(mInc) || mInc <= 0) {
      setFormError('Starting price and increment must be valid positive numbers.');
      return;
    }

    const now = new Date();
    const startTime = now.toISOString();
    const endTime = new Date(now.getTime() + dHours * 3600 * 1000).toISOString();

    try {
      await api.createAuction({
        title,
        description,
        category,
        imageUrl: imageUrl.trim() || undefined,
        startingPrice: sPrice,
        minimumIncrement: mInc,
        startTime,
        endTime,
      });

      setShowCreateModal(false);
      setTitle('');
      setDescription('');
      setImageUrl('');
      fetchManagedAuctions();
    } catch (err: any) {
      setFormError(err.message || 'Failed to create auction');
    }
  };

  const handleTogglePause = async (auction: Auction) => {
    setActionLoading(auction.id);
    const nextStatus = auction.status === 'active' ? 'paused' : 'active';
    try {
      await api.updateAuction(auction.id, { status: nextStatus });
      fetchManagedAuctions();
    } catch (err: any) {
      alert(`Error updating auction: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleCloseAuction = async (auctionId: string) => {
    if (!confirm('Are you sure you want to close this auction immediately and finalize the winner?')) return;
    setActionLoading(auctionId);
    try {
      await api.closeAuction(auctionId);
      fetchManagedAuctions();
    } catch (err: any) {
      alert(`Error closing auction: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
            <span>Auction Management</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-mono bg-purple-500/10 text-purple-400 border border-purple-500/20">
              Manager Portal
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Create listings, configure minimum increments, pause active auctions, and settle winners
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchManagedAuctions}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
            title="Refresh list"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-brand-500 hover:bg-brand-400 text-white shadow-lg shadow-brand-500/25 transition-all flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Auction</span>
          </button>
        </div>
      </div>

      {/* Auctions Table */}
      <div className="bg-navy-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-4">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Layers className="w-5 h-5 text-brand-400" />
          <span>Active & Historical Listings</span>
        </h2>

        {loading ? (
          <div className="py-12 text-center text-slate-500 text-xs font-mono">
            Loading auctions...
          </div>
        ) : auctions.length === 0 ? (
          <div className="py-16 text-center text-slate-500 text-xs font-mono">
            No auctions found. Click "Create New Auction" to publish one.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-[10px] uppercase font-mono tracking-wider text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Item Title</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Current Highest</th>
                  <th className="py-3 px-4">Increment</th>
                  <th className="py-3 px-4">Bids</th>
                  <th className="py-3 px-4">End Time</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {auctions.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                          a.status === 'active'
                            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                            : a.status === 'paused'
                            ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                            : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                        }`}
                      >
                        {a.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-sans font-medium text-white max-w-xs truncate">
                      {a.title}
                    </td>
                    <td className="py-3 px-4 text-slate-400">{a.category}</td>
                    <td className="py-3 px-4 font-bold text-accent-cyan">
                      ${a.currentHighestBid.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-slate-400">+${a.minimumIncrement.toFixed(2)}</td>
                    <td className="py-3 px-4 text-slate-300 font-bold">{a.bidCount}</td>
                    <td className="py-3 px-4 text-slate-400 text-[11px]">
                      {new Date(a.endTime).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td className="py-3 px-4 text-right space-x-2">
                      <Link
                        to={`/auctions/${a.id}`}
                        className="px-2.5 py-1 rounded-lg text-xs font-sans font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors inline-block"
                      >
                        View
                      </Link>

                      {a.status !== 'ended' && (
                        <>
                          <button
                            onClick={() => handleTogglePause(a)}
                            disabled={actionLoading === a.id}
                            className="px-2.5 py-1 rounded-lg text-xs font-sans font-semibold bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 transition-colors inline-flex items-center gap-1"
                          >
                            {a.status === 'active' ? (
                              <>
                                <Pause className="w-3 h-3" />
                                <span>Pause</span>
                              </>
                            ) : (
                              <>
                                <Play className="w-3 h-3" />
                                <span>Resume</span>
                              </>
                            )}
                          </button>

                          <button
                            onClick={() => handleCloseAuction(a.id)}
                            disabled={actionLoading === a.id}
                            className="px-2.5 py-1 rounded-lg text-xs font-sans font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 transition-colors inline-block"
                          >
                            Close Now
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Auction Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-navy-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-lg w-full bg-navy-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-brand-400" />
                <span>Publish New Auction</span>
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-white text-xs font-mono"
              >
                ✕ Close
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Item Title</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Rare Vintage Synthesizer 1982"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Description</label>
                <textarea
                  required
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Detailed description, specifications, and provenance..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-brand-500"
                  >
                    <option value="Electronics">Electronics</option>
                    <option value="Computing">Computing</option>
                    <option value="Watches">Watches</option>
                    <option value="Photography">Photography</option>
                    <option value="Collectibles">Collectibles</option>
                    <option value="Benchmark">Benchmark</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Duration (Hours)</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={durationHours}
                    onChange={(e) => setDurationHours(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Starting Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    value={startingPrice}
                    onChange={(e) => setStartingPrice(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono focus:outline-none focus:border-brand-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Min Increment ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.5"
                    required
                    value={minimumIncrement}
                    onChange={(e) => setMinimumIncrement(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Image URL (Optional)</label>
                <input
                  type="url"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://images.unsplash.com/..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-400 text-white font-semibold shadow-lg shadow-brand-500/25 transition-all"
                >
                  Publish Auction
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
