import React, { useState } from 'react';
import { Terminal, Search, Filter } from 'lucide-react';
import { MigrationLog } from '../types';

interface Props {
  logs: MigrationLog[];
}

export const LogsViewer: React.FC<Props> = ({ logs }) => {
  const [filter, setFilter] = useState('');
  const [levelFilter, setLevelFilter] = useState('ALL');

  const filteredLogs = logs.filter((log) => {
    const matchesText = log.message.toLowerCase().includes(filter.toLowerCase()) ||
      log.phase.toLowerCase().includes(filter.toLowerCase());
    const matchesLevel = levelFilter === 'ALL' || log.level === levelFilter;
    return matchesText && matchesLevel;
  });

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden font-mono text-xs flex flex-col h-80">
      {/* Console Bar */}
      <div className="bg-slate-900 px-4 py-2 border-b border-slate-800 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-slate-400">
          <Terminal className="w-4 h-4 text-indigo-400" />
          <span className="font-semibold text-slate-300">Live Execution Log</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-sans">
            {filteredLogs.length} events
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-500" />
            <input
              type="text"
              placeholder="Search logs..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="pl-8 pr-3 py-1 bg-slate-950 border border-slate-800 rounded text-slate-300 text-xs focus:outline-none focus:border-indigo-500 w-36 font-sans"
            />
          </div>

          {/* Level Filter */}
          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-300 text-xs focus:outline-none focus:border-indigo-500 font-sans"
          >
            <option value="ALL">All Levels</option>
            <option value="INFO">INFO</option>
            <option value="SUCCESS">SUCCESS</option>
            <option value="WARNING">WARNING</option>
            <option value="ERROR">ERROR</option>
          </select>
        </div>
      </div>

      {/* Log Output Stream */}
      <div className="p-4 overflow-y-auto flex-1 space-y-1.5 select-text">
        {filteredLogs.length === 0 ? (
          <div className="text-slate-600 italic py-4 text-center">No log events recorded.</div>
        ) : (
          filteredLogs.map((log) => {
            const timeStr = new Date(log.timestamp).toLocaleTimeString();
            let color = 'text-slate-300';
            let badge = 'text-slate-400 bg-slate-800';

            if (log.level === 'SUCCESS') {
              color = 'text-emerald-300';
              badge = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
            } else if (log.level === 'WARNING') {
              color = 'text-amber-300';
              badge = 'text-amber-400 bg-amber-500/10 border-amber-500/20';
            } else if (log.level === 'ERROR') {
              color = 'text-rose-300';
              badge = 'text-rose-400 bg-rose-500/10 border-rose-500/20';
            } else if (log.level === 'INFO') {
              color = 'text-sky-300';
              badge = 'text-sky-400 bg-sky-500/10 border-sky-500/20';
            }

            return (
              <div key={log.id} className="flex items-start gap-2.5 leading-relaxed font-mono">
                <span className="text-slate-500 shrink-0 select-none">{timeStr}</span>
                <span className={`px-1.5 py-0.2 rounded text-[10px] shrink-0 border ${badge} font-bold select-none`}>
                  {log.level}
                </span>
                <span className="text-indigo-400 shrink-0 font-medium select-none">[{log.phase}]</span>
                <span className={`${color} break-all`}>{log.message}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
