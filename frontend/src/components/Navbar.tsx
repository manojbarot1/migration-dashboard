import React from 'react';
import { RefreshCw, Server, Cloud, CheckCircle2, AlertCircle } from 'lucide-react';
import { SourceInfrastructure, TargetInfrastructure } from '../types';

interface Props {
  source?: SourceInfrastructure;
  target?: TargetInfrastructure;
  onRefresh: () => void;
  refreshing: boolean;
}

export const Navbar: React.FC<Props> = ({ source, target, onRefresh, refreshing }) => {
  const sourceConnected = source?.status === 'Connected';
  const targetConnected = target?.status === 'Connected';

  return (
    <header className="h-16 bg-slate-900/80 backdrop-blur border-b border-slate-800 px-8 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-4">
        <h1 className="text-base font-semibold text-slate-100">
          VM Migration Dashboard
        </h1>
        <span className="text-slate-600">/</span>
        <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-medium">
          Ubuntu Laptop &rarr; AWS EC2
        </span>
      </div>

      <div className="flex items-center gap-4">
        {/* Source Status Pill */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700/60 text-xs">
          <Server className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-400">Source:</span>
          {sourceConnected ? (
            <span className="text-emerald-400 font-medium flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Connected ({source?.name || 'Local'})
            </span>
          ) : (
            <span className="text-slate-400 font-medium">
              {source?.status || 'Not Connected'}
            </span>
          )}
        </div>

        {/* Target Status Pill */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700/60 text-xs">
          <Cloud className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-400">AWS:</span>
          {targetConnected ? (
            <span className="text-emerald-400 font-medium flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> {target?.account_id ? `Acc: ${target.account_id}` : 'Connected'}
            </span>
          ) : (
            <span className="text-amber-400 font-medium flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> {target?.status || 'Not Tested'}
            </span>
          )}
        </div>

        {/* Global Refresh */}
        <button
          onClick={onRefresh}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-indigo-400' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>
    </header>
  );
};
