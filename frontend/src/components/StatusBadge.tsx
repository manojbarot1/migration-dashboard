import React from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Clock, Play, PowerOff, ShieldCheck } from 'lucide-react';

interface Props {
  status: string;
  className?: string;
}

export const StatusBadge: React.FC<Props> = ({ status, className = '' }) => {
  const norm = status?.toLowerCase() || '';

  if (norm === 'connected' || norm === 'pass' || norm === 'completed') {
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 ${className}`}>
        <CheckCircle2 className="w-3.5 h-3.5" />
        {status}
      </span>
    );
  }

  if (norm === 'warning' || norm === 'completed with warnings') {
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20 ${className}`}>
        <AlertTriangle className="w-3.5 h-3.5" />
        {status}
      </span>
    );
  }

  if (norm === 'failed' || norm === 'blocked' || norm === 'error') {
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20 ${className}`}>
        <XCircle className="w-3.5 h-3.5" />
        {status}
      </span>
    );
  }

  if (norm === 'running') {
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20 ${className}`}>
        <Play className="w-3.5 h-3.5" />
        {status}
      </span>
    );
  }

  if (norm === 'shut off' || norm === 'stopped') {
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-500/10 text-slate-400 border border-slate-500/20 ${className}`}>
        <PowerOff className="w-3.5 h-3.5" />
        {status}
      </span>
    );
  }

  if (norm.includes('ing') || norm === 'pending') {
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 animate-pulse ${className}`}>
        <Clock className="w-3.5 h-3.5" />
        {status}
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-800 text-slate-400 border border-slate-700 ${className}`}>
      <Clock className="w-3.5 h-3.5" />
      {status || 'Not Tested'}
    </span>
  );
};
