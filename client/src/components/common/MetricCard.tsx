import React from 'react';
import { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtext?: string;
  icon: LucideIcon;
  variant?: 'brand' | 'cyan' | 'emerald' | 'amber' | 'rose';
  trend?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtext,
  icon: Icon,
  variant = 'brand',
  trend,
}) => {
  const variantStyles = {
    brand: 'text-brand-400 bg-brand-500/10 border-brand-500/20',
    cyan: 'text-accent-cyan bg-cyan-500/10 border-cyan-500/20',
    emerald: 'text-accent-emerald bg-emerald-500/10 border-emerald-500/20',
    amber: 'text-accent-amber bg-amber-500/10 border-amber-500/20',
    rose: 'text-accent-rose bg-rose-500/10 border-rose-500/20',
  };

  return (
    <div className="bg-navy-900/90 border border-slate-800 rounded-xl p-5 relative overflow-hidden shadow-sm hover:border-slate-700 transition-colors">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">{title}</p>
          <p className="text-2xl font-bold font-mono text-white mt-1.5 tracking-tight">{value}</p>
          {subtext && <p className="text-xs text-slate-400 mt-1">{subtext}</p>}
        </div>
        <div className={`p-2.5 rounded-xl border ${variantStyles[variant]}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      {trend && (
        <div className="mt-3 pt-3 border-t border-slate-800/80 text-[11px] font-mono text-slate-400 flex items-center justify-between">
          <span>Live Telemetry</span>
          <span className="text-emerald-400">{trend}</span>
        </div>
      )}
    </div>
  );
};
