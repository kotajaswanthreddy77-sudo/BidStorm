import React from 'react';
import { ShieldCheck, Database, Lock, Cpu } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="mt-auto border-t border-slate-800/80 bg-navy-900/60 py-8 text-slate-400 text-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <div>
            <span className="font-semibold text-white tracking-wider uppercase text-[11px] block mb-2">
              BidStorm Engine
            </span>
            <p className="text-slate-400 text-[12px] leading-relaxed">
              Real-time high-concurrency auction engine engineered with strict PostgreSQL row-level locks (<code className="text-brand-300">FOR UPDATE</code>) and idempotent submission pipelines.
            </p>
          </div>

          <div>
            <span className="font-semibold text-white tracking-wider uppercase text-[11px] block mb-2">
              Transactional Correctness
            </span>
            <ul className="space-y-1.5 text-[12px]">
              <li className="flex items-center gap-1.5 text-slate-300">
                <Lock className="w-3.5 h-3.5 text-accent-emerald" />
                <span>SELECT ... FOR UPDATE locks</span>
              </li>
              <li className="flex items-center gap-1.5 text-slate-300">
                <ShieldCheck className="w-3.5 h-3.5 text-accent-cyan" />
                <span>Zero Double-Winner Guarantee</span>
              </li>
              <li className="flex items-center gap-1.5 text-slate-300">
                <Database className="w-3.5 h-3.5 text-accent-amber" />
                <span>Unique Idempotency Keys</span>
              </li>
            </ul>
          </div>

          <div>
            <span className="font-semibold text-white tracking-wider uppercase text-[11px] block mb-2">
              Platform Architecture
            </span>
            <ul className="space-y-1.5 text-[12px]">
              <li>Node.js 20 & Express & TypeScript</li>
              <li>PostgreSQL 16 & Wasm Engine</li>
              <li>Socket.IO Real-Time Engine</li>
              <li>Vitest Concurrency Verification</li>
            </ul>
          </div>

          <div>
            <span className="font-semibold text-white tracking-wider uppercase text-[11px] block mb-2">
              Hackathon Demo Notice
            </span>
            <p className="text-slate-400 text-[12px] leading-relaxed">
              This system demonstrates distributed locking and load simulation. Simulated currencies and demo items are for educational testing purposes only.
            </p>
          </div>
        </div>

        <div className="pt-6 border-t border-slate-800/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-slate-500 text-[11px]">
          <div>
            © 2026 BidStorm Platform. College Hackathon Distributed Systems Showcase.
          </div>
          <div className="flex items-center space-x-4">
            <span className="flex items-center gap-1 text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Row-Lock Engine Active
            </span>
            <span>Latency SLA: &lt;50ms</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
