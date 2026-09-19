import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

interface CountdownTimerProps {
  endTime: string;
  onEnd?: () => void;
  compact?: boolean;
}

export const CountdownTimer: React.FC<CountdownTimerProps> = ({ endTime, onEnd, compact = false }) => {
  const [timeLeft, setTimeLeft] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    isEnded: boolean;
  }>({ days: 0, hours: 0, minutes: 0, seconds: 0, isEnded: false });

  useEffect(() => {
    const calculateTime = () => {
      const difference = new Date(endTime).getTime() - Date.now();

      if (difference <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, isEnded: true });
        if (onEnd) onEnd();
        return;
      }

      const days = Math.floor(difference / (1000 * 60 * 60 * 24));
      const hours = Math.floor((difference / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((difference / 1000 / 60) % 60);
      const seconds = Math.floor((difference / 1000) % 60);

      setTimeLeft({ days, hours, minutes, seconds, isEnded: false });
    };

    calculateTime();
    const interval = setInterval(calculateTime, 1000);
    return () => clearInterval(interval);
  }, [endTime, onEnd]);

  if (timeLeft.isEnded) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-medium bg-rose-500/20 text-rose-400 border border-rose-500/30">
        <Clock className="w-3.5 h-3.5" />
        Auction Ended
      </span>
    );
  }

  const isEndingSoon = timeLeft.days === 0 && timeLeft.hours === 0 && timeLeft.minutes < 30;

  if (compact) {
    return (
      <span
        className={`inline-flex items-center gap-1 text-xs font-mono font-medium ${
          isEndingSoon ? 'text-rose-400 font-bold animate-pulse' : 'text-slate-300'
        }`}
      >
        <Clock className="w-3.5 h-3.5 text-slate-400" />
        {timeLeft.days > 0 && `${timeLeft.days}d `}
        {String(timeLeft.hours).padStart(2, '0')}:{String(timeLeft.minutes).padStart(2, '0')}:
        {String(timeLeft.seconds).padStart(2, '0')}
      </span>
    );
  }

  return (
    <div className="flex items-center space-x-2 font-mono text-xs">
      {timeLeft.days > 0 && (
        <div className="flex flex-col items-center bg-slate-800/80 px-2.5 py-1.5 rounded-lg border border-slate-700">
          <span className="text-base font-bold text-white">{timeLeft.days}</span>
          <span className="text-[10px] text-slate-400 uppercase">Days</span>
        </div>
      )}
      <div className="flex flex-col items-center bg-slate-800/80 px-2.5 py-1.5 rounded-lg border border-slate-700">
        <span className="text-base font-bold text-white">{String(timeLeft.hours).padStart(2, '0')}</span>
        <span className="text-[10px] text-slate-400 uppercase">Hours</span>
      </div>
      <div className="text-slate-500 font-bold">:</div>
      <div className="flex flex-col items-center bg-slate-800/80 px-2.5 py-1.5 rounded-lg border border-slate-700">
        <span className="text-base font-bold text-white">{String(timeLeft.minutes).padStart(2, '0')}</span>
        <span className="text-[10px] text-slate-400 uppercase">Mins</span>
      </div>
      <div className="text-slate-500 font-bold">:</div>
      <div
        className={`flex flex-col items-center px-2.5 py-1.5 rounded-lg border ${
          isEndingSoon
            ? 'bg-rose-950/40 border-rose-500/50 text-rose-400 animate-pulse'
            : 'bg-slate-800/80 border-slate-700 text-white'
        }`}
      >
        <span className="text-base font-bold">{String(timeLeft.seconds).padStart(2, '0')}</span>
        <span className="text-[10px] uppercase opacity-75">Secs</span>
      </div>
    </div>
  );
};
