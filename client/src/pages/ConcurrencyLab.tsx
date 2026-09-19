import React, { useState, useEffect } from 'react';
import { api } from '../services/api.js';
import { Auction, TestRun, VerificationReport } from '../types/index.js';
import { getSocket, joinAdminRoom } from '../services/socket.js';
import {
  Zap,
  Play,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldCheck,
  Activity,
  Layers,
  Download,
  Flame,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

export const ConcurrencyLab: React.FC = () => {
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [selectedAuctionId, setSelectedAuctionId] = useState<string>('');
  const [strategy, setStrategy] = useState<'same_amount' | 'incremental' | 'random_concurrent'>('same_amount');
  const [totalRequests, setTotalRequests] = useState<number>(100);
  const [concurrency, setConcurrency] = useState<number>(10);
  const [numClients, setNumClients] = useState<number>(10);

  const [isRunning, setIsRunning] = useState(false);
  const [liveProgress, setLiveProgress] = useState<{
    sent: number;
    accepted: number;
    rejected: number;
    errors: number;
    currentRps: number;
    progressPercent: number;
  }>({
    sent: 0,
    accepted: 0,
    rejected: 0,
    errors: 0,
    currentRps: 0,
    progressPercent: 0,
  });

  const [latestSummary, setLatestSummary] = useState<any | null>(null);
  const [verification, setVerification] = useState<VerificationReport | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [historyRuns, setHistoryRuns] = useState<TestRun[]>([]);

  // Fetch benchmark auctions
  useEffect(() => {
    joinAdminRoom();

    api.getAuctions({ limit: 50 }).then((res) => {
      setAuctions(res.auctions);
      const bench = res.auctions.find((a) => a.category === 'Benchmark') || res.auctions[0];
      if (bench) {
        setSelectedAuctionId(bench.id);
      }
    });

    api.getTestRuns().then((res) => setHistoryRuns(res.testRuns)).catch(() => {});

    // Listen to real-time simulation progress
    const socket = getSocket();
    const handleProgress = (data: any) => {
      setLiveProgress(data);
    };

    socket.on('simulation:progress', handleProgress);
    return () => {
      socket.off('simulation:progress', handleProgress);
    };
  }, []);

  const handleApplyPreset = (requests: number, conc: number, clients: number) => {
    setTotalRequests(requests);
    setConcurrency(conc);
    setNumClients(clients);
  };

  const handleStartSimulation = async () => {
    if (!selectedAuctionId || isRunning) return;

    setIsRunning(true);
    setVerification(null);
    setLatestSummary(null);
    setLiveProgress({
      sent: 0,
      accepted: 0,
      rejected: 0,
      errors: 0,
      currentRps: 0,
      progressPercent: 0,
    });

    try {
      const summary = await api.runSimulation({
        auctionId: selectedAuctionId,
        totalRequests,
        concurrency,
        strategy,
        resetAuctionBeforeRun: true,
      });

      setLatestSummary(summary);
      if (summary.verification) {
        setVerification(summary.verification);
      }

      // Refresh history
      api.getTestRuns().then((res) => setHistoryRuns(res.testRuns)).catch(() => {});
    } catch (err: any) {
      alert(`Simulation failed: ${err.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  const handleRunVerification = async () => {
    if (!latestSummary?.testRunId || verifying) return;
    setVerifying(true);
    try {
      const rep = await api.verifyTestRun(latestSummary.testRunId);
      setVerification(rep);
    } catch (err: any) {
      alert(`Verification failed: ${err.message}`);
    } finally {
      setVerifying(false);
    }
  };

  const handleResetAuction = async () => {
    try {
      await api.resetTestAuction(selectedAuctionId);
      alert('Test auction state successfully reset to initial starting price and 0 bids.');
    } catch (err: any) {
      alert(`Reset failed: ${err.message}`);
    }
  };

  const handleExportReport = (format: 'json' | 'csv') => {
    if (!latestSummary) return;

    const dataToExport = {
      testRun: latestSummary,
      verification,
      exportedAt: new Date().toISOString(),
    };

    if (format === 'json') {
      const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bidstorm-test-run-${latestSummary.testRunId.slice(0, 8)}.json`;
      a.click();
    } else {
      // Export as CSV
      const rows = [
        ['Metric', 'Value'],
        ['Test Run ID', latestSummary.testRunId],
        ['Strategy', latestSummary.strategy],
        ['Requested Requests', latestSummary.requestedRequests],
        ['Concurrency', latestSummary.concurrency],
        ['Accepted Count', latestSummary.acceptedCount],
        ['Rejected Count', latestSummary.rejectedCount],
        ['Error Count', latestSummary.errorCount],
        ['Duration (ms)', latestSummary.durationMs],
        ['Requests/sec (RPS)', latestSummary.requestsPerSecond],
        ['p50 Latency (ms)', latestSummary.stats.p50LatencyMs],
        ['p95 Latency (ms)', latestSummary.stats.p95LatencyMs],
        ['Final Highest Bid ($)', latestSummary.finalHighestBid],
        ['Invariant Verification Status', verification?.passed ? 'PASS' : 'FAIL'],
      ];
      const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.join(',')).join('\n');
      const encodedUri = encodeURI(csvContent);
      const a = document.createElement('a');
      a.href = encodedUri;
      a.download = `bidstorm-test-run-${latestSummary.testRunId.slice(0, 8)}.csv`;
      a.click();
    }
  };

  const latencyChartData = latestSummary?.stats ? [
    { name: 'Min', latency: latestSummary.stats.minLatencyMs },
    { name: 'p50', latency: latestSummary.stats.p50LatencyMs },
    { name: 'Avg', latency: latestSummary.stats.avgLatencyMs },
    { name: 'p95', latency: latestSummary.stats.p95LatencyMs },
    { name: 'p99', latency: latestSummary.stats.p99LatencyMs },
    { name: 'Max', latency: latestSummary.stats.maxLatencyMs },
  ] : [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-2.5">
              <span>Concurrency Lab</span>
              <Flame className="w-6 h-6 text-accent-amber fill-accent-amber animate-pulse" />
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-mono bg-amber-500/15 text-amber-300 border border-amber-500/30">
              Stress Tester & Verifier
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400">
            Execute controlled high-concurrency bid bursts against dedicated test auctions and verify PostgreSQL row-locking invariants
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleResetAuction}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors flex items-center gap-1.5"
            title="Reset auction state to starting price"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Test Auction</span>
          </button>
        </div>
      </div>

      {/* Control Panel Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Test Configuration Form */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-navy-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-5">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Zap className="w-4 h-4 text-accent-amber" />
              <span>Simulation Parameters</span>
            </h2>

            {/* Presets */}
            <div>
              <span className="block text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-2">
                Quick Test Presets
              </span>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => handleApplyPreset(100, 10, 10)}
                  className="py-2 px-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium text-center transition-colors"
                >
                  <strong className="block text-white">100 Reqs</strong>
                  <span className="text-[10px] text-slate-400">10 clients</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPreset(1000, 50, 50)}
                  className="py-2 px-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium text-center transition-colors"
                >
                  <strong className="block text-white">1,000 Reqs</strong>
                  <span className="text-[10px] text-slate-400">50 clients</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPreset(5000, 50, 100)}
                  className="py-2 px-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium text-center transition-colors"
                >
                  <strong className="block text-white">5,000 Reqs</strong>
                  <span className="text-[10px] text-slate-400">100 clients</span>
                </button>
              </div>
            </div>

            {/* Target Auction Selector */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Target Auction</label>
              <select
                value={selectedAuctionId}
                onChange={(e) => setSelectedAuctionId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-brand-500"
              >
                {auctions.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.title} ({a.category}) — Current: ${a.currentHighestBid.toFixed(2)}
                  </option>
                ))}
              </select>
            </div>

            {/* Concurrency Strategy */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Bid Submission Strategy
              </label>
              <div className="space-y-2 text-xs">
                <label className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                  strategy === 'same_amount'
                    ? 'bg-brand-500/10 border-brand-500 text-white'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}>
                  <input
                    type="radio"
                    name="strategy"
                    value="same_amount"
                    checked={strategy === 'same_amount'}
                    onChange={() => setStrategy('same_amount')}
                    className="mt-0.5"
                  />
                  <div>
                    <strong className="block text-slate-200">Strategy A: Same Amount (Race)</strong>
                    <span className="text-[11px] text-slate-400 leading-snug block mt-0.5">
                      Multiple clients attempt the exact same bid amount. Exactly 1 must win; all others rejected.
                    </span>
                  </div>
                </label>

                <label className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                  strategy === 'incremental'
                    ? 'bg-brand-500/10 border-brand-500 text-white'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}>
                  <input
                    type="radio"
                    name="strategy"
                    value="incremental"
                    checked={strategy === 'incremental'}
                    onChange={() => setStrategy('incremental')}
                    className="mt-0.5"
                  />
                  <div>
                    <strong className="block text-slate-200">Strategy B: Incremental Bids</strong>
                    <span className="text-[11px] text-slate-400 leading-snug block mt-0.5">
                      Bidders submit increasing valid amounts concurrently. Evaluates serial row lock throughput.
                    </span>
                  </div>
                </label>

                <label className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                  strategy === 'random_concurrent'
                    ? 'bg-brand-500/10 border-brand-500 text-white'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}>
                  <input
                    type="radio"
                    name="strategy"
                    value="random_concurrent"
                    checked={strategy === 'random_concurrent'}
                    onChange={() => setStrategy('random_concurrent')}
                    className="mt-0.5"
                  />
                  <div>
                    <strong className="block text-slate-200">Strategy C: Random Concurrent Mix</strong>
                    <span className="text-[11px] text-slate-400 leading-snug block mt-0.5">
                      Mix of valid, duplicate idempotency keys, and outdated bids simulating real chaotic traffic.
                    </span>
                  </div>
                </label>
              </div>
            </div>

            {/* Sliders: Requests & Concurrency */}
            <div className="grid grid-cols-2 gap-4 text-xs font-mono">
              <div>
                <label className="block text-slate-400 mb-1">Total Requests: <strong className="text-white">{totalRequests}</strong></label>
                <input
                  type="range"
                  min="10"
                  max="5000"
                  step="10"
                  value={totalRequests}
                  onChange={(e) => setTotalRequests(parseInt(e.target.value, 10))}
                  className="w-full accent-brand-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Workers (Concurrency): <strong className="text-white">{concurrency}</strong></label>
                <input
                  type="range"
                  min="1"
                  max="50"
                  value={concurrency}
                  onChange={(e) => setConcurrency(parseInt(e.target.value, 10))}
                  className="w-full accent-accent-cyan"
                />
              </div>
            </div>

            {/* Launch Button */}
            <button
              type="button"
              onClick={handleStartSimulation}
              disabled={isRunning}
              className="w-full py-3.5 px-4 rounded-xl font-bold text-sm bg-gradient-to-r from-amber-500 via-brand-500 to-accent-cyan hover:from-amber-400 hover:to-accent-cyan text-white shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>{isRunning ? 'Executing Real Load via SELECT FOR UPDATE...' : 'Launch Live Stress Simulation'}</span>
            </button>
          </div>
        </div>

        {/* Right Column: Live Monitor & Execution Results */}
        <div className="lg:col-span-7 space-y-6">
          {/* Real-time Progress & Gauge */}
          <div className="bg-navy-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${isRunning ? 'bg-amber-400 animate-ping' : 'bg-slate-500'}`} />
                {isRunning ? 'Simulation Running...' : 'Simulation Ready / Idle'}
              </span>
              <span className="font-mono text-xs text-accent-cyan font-bold">
                {liveProgress.currentRps} req/s
              </span>
            </div>

            {/* Progress bar */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-mono text-slate-400">
                <span>Completed: {liveProgress.sent} / {totalRequests}</span>
                <span>{liveProgress.progressPercent}%</span>
              </div>
              <div className="w-full bg-slate-950 rounded-full h-3 overflow-hidden border border-slate-800">
                <div
                  className="bg-gradient-to-r from-brand-500 via-accent-cyan to-emerald-400 h-3 rounded-full transition-all duration-200"
                  style={{ width: `${liveProgress.progressPercent}%` }}
                />
              </div>
            </div>

            {/* Live Counters */}
            <div className="grid grid-cols-4 gap-3 pt-2 text-center font-mono">
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase block">Sent</span>
                <span className="text-lg font-bold text-white">{liveProgress.sent}</span>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-[10px] text-emerald-400 uppercase block">Accepted</span>
                <span className="text-lg font-bold text-emerald-400">{liveProgress.accepted}</span>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-[10px] text-rose-400 uppercase block">Rejected</span>
                <span className="text-lg font-bold text-rose-400">{liveProgress.rejected}</span>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-[10px] text-amber-400 uppercase block">Errors</span>
                <span className="text-lg font-bold text-amber-400">{liveProgress.errors}</span>
              </div>
            </div>
          </div>

          {/* Post-Test Performance Analysis & Chart */}
          {latestSummary && (
            <div className="bg-navy-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-5 animate-in fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Activity className="w-4 h-4 text-accent-cyan" />
                    <span>Post-Test Latency Spectrum</span>
                  </h3>
                  <p className="text-xs text-slate-400">Total duration: {latestSummary.durationMs}ms | Throughput: {latestSummary.requestsPerSecond} req/s</p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleExportReport('json')}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono flex items-center gap-1.5 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>JSON</span>
                  </button>
                  <button
                    onClick={() => handleExportReport('csv')}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono flex items-center gap-1.5 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>CSV</span>
                  </button>
                </div>
              </div>

              {/* Latency Chart */}
              <div className="h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={latencyChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} />
                    <YAxis stroke="#64748b" fontSize={11} tickLine={false} unit="ms" />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                      formatter={(val: any) => [`${val} ms`, 'Latency']}
                    />
                    <Bar dataKey="latency" radius={[4, 4, 0, 0]}>
                      {latencyChartData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={index > 3 ? '#f59e0b' : '#38bdf8'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Latency Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <span className="text-slate-500 text-[10px] block">p50 Latency</span>
                  <span className="text-white font-bold text-sm">{latestSummary.stats.p50LatencyMs} ms</span>
                </div>
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <span className="text-slate-500 text-[10px] block">p95 Latency</span>
                  <span className="text-accent-cyan font-bold text-sm">{latestSummary.stats.p95LatencyMs} ms</span>
                </div>
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <span className="text-slate-500 text-[10px] block">Final Highest Bid</span>
                  <span className="text-accent-emerald font-bold text-sm">${latestSummary.finalHighestBid.toFixed(2)}</span>
                </div>
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <span className="text-slate-500 text-[10px] block">Unique Keys</span>
                  <span className="text-white font-bold text-sm">{latestSummary.stats.uniqueAcceptedKeys}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Correctness Verification Section (Section 9) */}
      <div className="bg-navy-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-accent-cyan" />
              <h2 className="text-xl font-bold text-white">
                Automated PostgreSQL Correctness Verification
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Backend validation service executing 7 strict database invariant queries to prove absence of race conditions
            </p>
          </div>

          <div className="flex items-center gap-3">
            {verification && (
              <span
                className={`px-4 py-1.5 rounded-full text-xs font-mono font-bold tracking-wider uppercase border flex items-center gap-1.5 ${
                  verification.passed
                    ? 'bg-emerald-950/80 text-emerald-400 border-emerald-500/50'
                    : 'bg-rose-950/80 text-rose-400 border-rose-500/50'
                }`}
              >
                {verification.passed ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>ALL INVARIANTS PASSED</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-4 h-4" />
                    <span>INVARIANT VIOLATIONS DETECTED</span>
                  </>
                )}
              </span>
            )}

            {latestSummary && (
              <button
                onClick={handleRunVerification}
                disabled={verifying}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-brand-500 hover:bg-brand-400 text-white transition-colors flex items-center gap-1.5"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>{verifying ? 'Verifying Database Invariants...' : 'Run Correctness Check'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Invariant Checklist Grid */}
        {verification ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-mono text-slate-400 pb-1">
              <span>Verified Scope: {verification.scope.acceptedBidsCount} accepted bids across {verification.scope.requestedRequests} requests</span>
              <span className="text-emerald-400 font-bold">{verification.passedChecks} of {verification.totalChecks} Checks Passed</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {verification.checks.map((check) => (
                <div
                  key={check.id}
                  className={`p-4 rounded-2xl border transition-all ${
                    check.passed
                      ? 'bg-navy-950/60 border-emerald-500/25 text-slate-200'
                      : 'bg-rose-950/30 border-rose-500/40 text-rose-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        {check.passed ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                        )}
                        <h4 className="font-semibold text-xs text-white">{check.name}</h4>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                        {check.description}
                      </p>
                    </div>

                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold uppercase ${
                        check.passed
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                      }`}
                    >
                      {check.passed ? 'PASS' : 'FAIL'}
                    </span>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-slate-800/80 text-[11px] font-mono text-slate-400">
                    {check.details}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="py-12 text-center text-slate-500 text-xs font-mono bg-navy-950/40 rounded-2xl border border-slate-800">
            Launch a simulation above to automatically execute and inspect the 7 database correctness invariants.
          </div>
        )}
      </div>

      {/* Historical Test Runs Table */}
      {historyRuns.length > 0 && (
        <div className="bg-navy-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Clock className="w-4 h-4 text-brand-400" />
            <span>Past Simulation Runs History</span>
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="text-[10px] uppercase text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Test ID</th>
                  <th className="py-3 px-4">Strategy</th>
                  <th className="py-3 px-4">Requests</th>
                  <th className="py-3 px-4">Concurrency</th>
                  <th className="py-3 px-4">Accepted</th>
                  <th className="py-3 px-4">Rejected</th>
                  <th className="py-3 px-4">Duration</th>
                  <th className="py-3 px-4">p95 Latency</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {historyRuns.slice(0, 5).map((tr) => (
                  <tr key={tr.id} className="hover:bg-slate-800/30">
                    <td className="py-3 px-4 text-slate-300 font-bold">{tr.id.slice(0, 8)}...</td>
                    <td className="py-3 px-4 text-brand-300 capitalize">{tr.strategy.replace('_', ' ')}</td>
                    <td className="py-3 px-4 text-white">{tr.requested_requests}</td>
                    <td className="py-3 px-4 text-slate-400">{tr.concurrency} workers</td>
                    <td className="py-3 px-4 text-emerald-400 font-bold">{tr.accepted_count}</td>
                    <td className="py-3 px-4 text-rose-400 font-bold">{tr.rejected_count}</td>
                    <td className="py-3 px-4 text-slate-300">{tr.duration_ms} ms</td>
                    <td className="py-3 px-4 text-accent-cyan">{tr.stats?.p95LatencyMs || 0} ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
