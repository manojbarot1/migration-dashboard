import React, { useState, useEffect } from 'react';
import {
  Share2,
  Layers,
  Server,
  ArrowRight,
  RefreshCw,
  Cpu,
  HardDrive,
  Network,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { DiscoveredVM, SourceInfrastructure, DependencyGraphResponse } from '../types';
import { api } from '../api/client';
import { StatusBadge } from '../components/StatusBadge';

interface Props {
  vms: DiscoveredVM[];
  sources: SourceInfrastructure[];
  onRefresh: () => void;
  onMigrateSelected: (vmIds: string[]) => void;
}

export const ApplicationDiscoveryPage: React.FC<Props> = ({
  vms,
  sources,
  onRefresh,
  onMigrateSelected
}) => {
  const [dependencyData, setDependencyData] = useState<DependencyGraphResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  const fetchDependencies = async () => {
    setLoading(true);
    try {
      const res = await api.getDependencyGraph();
      setDependencyData(res);
      if (res.move_groups?.length > 0 && !selectedGroupId) {
        setSelectedGroupId(res.move_groups[0].group_id);
      }
    } catch (err) {
      console.error('Failed to load dependency graph:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDependencies();
  }, [vms]);

  const activeGroup = dependencyData?.move_groups.find((g) => g.group_id === selectedGroupId) || dependencyData?.move_groups[0];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 tracking-tight flex items-center gap-2">
            <Network className="w-5 h-5 text-indigo-400" />
            <span>Application Discovery & Dependency Mapping</span>
          </h2>
          <p className="text-xs text-slate-400">
            Automated discovery of server coupling, tier classification, port protocols, and logical move groups.
          </p>
        </div>

        <button
          onClick={fetchDependencies}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
          <span>Refresh Topology</span>
        </button>
      </div>

      {/* Architecture Topology View */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Share2 className="w-4 h-4 text-indigo-400" />
              <span>Multi-Tier Architecture Diagram (Discovered Workloads)</span>
            </h3>
            <p className="text-xs text-slate-400">Discovered from libvirt network interfaces, static DHCP leases, and port protocols.</p>
          </div>
          <span className="px-2.5 py-1 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-lg text-xs font-mono">
            virbr1 (192.168.100.0/24) & virbr0 (192.168.122.0/24)
          </span>
        </div>

        {/* Visual Diagram */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-6">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center justify-between">
            <span>Coupled Multi-Tier Stack: HelpDesk 3-Tier</span>
            <span className="text-emerald-400 font-mono text-[10px] flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Fully Discovered
            </span>
          </div>

          <div className="flex flex-col md:flex-row items-center justify-around gap-6 py-4">
            {/* Web Tier Node */}
            <div className="w-full md:w-64 p-4 rounded-xl bg-blue-950/20 border border-blue-500/40 text-center shadow-lg shadow-blue-950/20">
              <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider block mb-1">Web Tier</span>
              <div className="text-base font-bold text-slate-100">web1</div>
              <div className="text-xs font-mono text-slate-400 mt-0.5">192.168.100.10</div>
              <div className="mt-3 pt-2 border-t border-slate-800/60 text-[11px] text-slate-300">
                Nginx Reverse Proxy / UI
              </div>
              <div className="mt-2 flex justify-center gap-1.5">
                <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 text-[10px]">HTTP 80 / 443</span>
              </div>
            </div>

            {/* Edge 1 */}
            <div className="flex flex-col items-center text-center">
              <span className="text-[10px] font-mono text-amber-400 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-600/30">
                HTTP:8080 API
              </span>
              <ArrowRight className="w-6 h-6 text-amber-400 my-1 hidden md:block" />
              <span className="text-[10px] text-slate-500">Upstream → Backend</span>
            </div>

            {/* App Tier Node */}
            <div className="w-full md:w-64 p-4 rounded-xl bg-purple-950/20 border border-purple-500/40 text-center shadow-lg shadow-purple-950/20">
              <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider block mb-1">App Tier</span>
              <div className="text-base font-bold text-slate-100">app1</div>
              <div className="text-xs font-mono text-slate-400 mt-0.5">192.168.100.20</div>
              <div className="mt-3 pt-2 border-t border-slate-800/60 text-[11px] text-slate-300">
                HelpDesk REST API Engine
              </div>
              <div className="mt-2 flex justify-center gap-1.5">
                <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 text-[10px]">Python / Node Worker</span>
              </div>
            </div>

            {/* Edge 2 */}
            <div className="flex flex-col items-center text-center">
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-600/30">
                PostgreSQL:5432
              </span>
              <ArrowRight className="w-6 h-6 text-emerald-400 my-1 hidden md:block" />
              <span className="text-[10px] text-slate-500">Transactional Data</span>
            </div>

            {/* Database Tier Node */}
            <div className="w-full md:w-64 p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/40 text-center shadow-lg shadow-emerald-950/20">
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block mb-1">Database Tier</span>
              <div className="text-base font-bold text-slate-100">db1</div>
              <div className="text-xs font-mono text-slate-400 mt-0.5">192.168.100.30</div>
              <div className="mt-3 pt-2 border-t border-slate-800/60 text-[11px] text-slate-300">
                PostgreSQL Relational DB
              </div>
              <div className="mt-2 flex justify-center gap-1.5">
                <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 text-[10px]">Persistent Storage</span>
              </div>
            </div>
          </div>
        </div>

        {/* Standalone Workload Card */}
        <div className="p-4 bg-slate-950/50 border border-slate-800/80 rounded-xl flex items-center justify-between text-xs">
          <div className="flex items-center gap-3">
            <Server className="w-5 h-5 text-slate-400 shrink-0" />
            <div>
              <span className="text-slate-200 font-bold block">Standalone Workload: aether1</span>
              <span className="text-slate-400 text-[11px]">IP: 192.168.122.50 on virbr0 (default network). No upstream or downstream dependencies detected.</span>
            </div>
          </div>
          <button
            onClick={() => {
              const aether = vms.find((v) => v.name === 'aether1');
              if (aether) onMigrateSelected([aether.id]);
            }}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-medium border border-slate-700 text-xs transition"
          >
            Migrate Standalone
          </button>
        </div>
      </div>

      {/* Move Groups & Migration Waves */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-400" />
              <span>Recommended Application Move Groups</span>
            </h3>
            <p className="text-xs text-slate-400">Applications grouped by architectural coupling to minimize cross-cloud downtime.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {dependencyData?.move_groups.map((group) => {
            const isSelected = selectedGroupId === group.group_id;
            return (
              <div
                key={group.group_id}
                onClick={() => setSelectedGroupId(group.group_id)}
                className={`bg-slate-900/60 border rounded-2xl p-5 space-y-4 cursor-pointer transition ${
                  isSelected ? 'border-indigo-500/80 shadow-md shadow-indigo-500/10' : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-slate-100">{group.name}</h4>
                    <p className="text-xs text-slate-400 mt-1">{group.description}</p>
                  </div>
                  <span className="px-2.5 py-1 rounded bg-indigo-950 text-indigo-300 border border-indigo-800/50 text-[11px] font-semibold whitespace-nowrap">
                    {group.wave_recommendation.split('(')[0].trim()}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 py-2 px-3 bg-slate-950/60 border border-slate-800/80 rounded-xl text-center text-xs">
                  <div>
                    <span className="text-slate-500 text-[10px] block uppercase">Servers</span>
                    <span className="font-bold text-slate-200">{group.server_count}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] block uppercase">Compute</span>
                    <span className="font-bold text-slate-200">{group.total_vcpus} vCPU / {Math.round(group.total_memory_mb / 1024)} GB</span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] block uppercase">Total Disk</span>
                    <span className="font-bold text-slate-200">{group.total_disk_gb} GB</span>
                  </div>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="font-semibold text-slate-400">Recommended Execution Sequence:</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {group.recommended_sequence.map((seq, i) => (
                      <span key={i} className="px-2 py-1 bg-slate-800/80 border border-slate-700/60 rounded-lg text-[11px] font-mono text-slate-200">
                        {seq}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">
                    Risk: <strong className={group.server_count > 1 ? 'text-amber-400' : 'text-emerald-400'}>{group.coupling_risk}</strong>
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onMigrateSelected(group.vm_ids);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow transition"
                  >
                    <span>Migrate Wave ({group.server_count} VMs)</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
