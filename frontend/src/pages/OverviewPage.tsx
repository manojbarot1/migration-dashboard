import React from 'react';
import {
  Server,
  Cloud,
  Layers,
  ArrowRightCircle,
  PlayCircle,
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
  Plus
} from 'lucide-react';
import { DashboardOverview } from '../types';
import { MetricCard } from '../components/MetricCard';
import { StatusBadge } from '../components/StatusBadge';

interface Props {
  data: DashboardOverview | null;
  loading: boolean;
  onNavigate: (tab: string) => void;
}

export const OverviewPage: React.FC<Props> = ({ data, loading, onNavigate }) => {
  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        <Clock className="w-6 h-6 animate-spin mr-2 text-indigo-500" />
        <span>Loading dashboard overview...</span>
      </div>
    );
  }

  const d = data || {
    total_sources: 0,
    total_targets: 0,
    total_vms: 0,
    vms_selected_for_migration: 0,
    migrations_in_progress: 0,
    migrations_completed: 0,
    migrations_failed: 0,
    recent_activities: [],
    sources_summary: [],
    vms_summary: [],
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-indigo-900/40 via-slate-900 to-slate-900 border border-indigo-500/20 rounded-2xl p-6 flex items-center justify-between shadow-xl">
        <div className="space-y-1">
          <h2 className="text-xl font-bold text-white tracking-tight">
            VM Migration Dashboard
          </h2>
          <p className="text-sm text-slate-400">
            Real-time migration orchestration from local QEMU/KVM hypervisor to Amazon Web Services (AWS EC2).
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate('wizard')}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-indigo-600/30 transition"
          >
            <ArrowRightCircle className="w-4 h-4" />
            <span>Start Migration</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Source Infrastructures"
          value={d.total_sources}
          subtitle="QEMU/KVM hosts"
          icon={<Server className="w-5 h-5" />}
          variant="info"
          onClick={() => onNavigate('source')}
        />
        <MetricCard
          title="Target AWS Accounts"
          value={d.total_targets}
          subtitle="Configured clouds"
          icon={<Cloud className="w-5 h-5" />}
          variant="default"
          onClick={() => onNavigate('target')}
        />
        <MetricCard
          title="Discovered Virtual Machines"
          value={d.total_vms}
          subtitle="Ready for assessment"
          icon={<Layers className="w-5 h-5" />}
          variant="info"
          onClick={() => onNavigate('inventory')}
        />
        <MetricCard
          title="Active Migrations"
          value={d.migrations_in_progress}
          subtitle="In flight"
          icon={<PlayCircle className="w-5 h-5" />}
          variant={d.migrations_in_progress > 0 ? "warning" : "default"}
          onClick={() => onNavigate('history')}
        />
      </div>

      {/* Migration Outcomes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-emerald-500/10 text-emerald-400">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs uppercase font-semibold text-slate-400">Successful Migrations</span>
              <div className="text-2xl font-bold text-slate-100">{d.migrations_completed}</div>
            </div>
          </div>
          <span className="text-xs text-emerald-400 font-medium">EC2 instances live</span>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-rose-500/10 text-rose-400">
              <XCircle className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs uppercase font-semibold text-slate-400">Failed / Cancelled</span>
              <div className="text-2xl font-bold text-slate-100">{d.migrations_failed}</div>
            </div>
          </div>
          <span className="text-xs text-slate-400 font-medium">Safe retry available</span>
        </div>
      </div>

      {/* Two Column Layout: Source & Discovered VMs, Recent Activities */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Discovered VMs preview (2 cols) */}
        <div className="lg:col-span-2 bg-slate-900/60 border border-slate-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-semibold text-slate-100">Discovered Virtual Machines</h3>
              <p className="text-xs text-slate-400">Virtual machines detected on connected hypervisors</p>
            </div>
            <button
              onClick={() => onNavigate('inventory')}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1"
            >
              <span>View All Inventory</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/60 text-slate-400 font-semibold border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">VM Name</th>
                  <th className="py-3 px-4">State</th>
                  <th className="py-3 px-4">OS Family</th>
                  <th className="py-3 px-4">Compute</th>
                  <th className="py-3 px-4">Disk Capacity</th>
                  <th className="py-3 px-4">Compatibility</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {d.vms_summary.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500">
                      No VMs discovered yet. Go to <button onClick={() => onNavigate('source')} className="text-indigo-400 underline">Source Infrastructure</button> and click "Discover VMs".
                    </td>
                  </tr>
                ) : (
                  d.vms_summary.map((vm: any) => (
                    <tr key={vm.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4 font-medium text-slate-200">{vm.name}</td>
                      <td className="py-3 px-4"><StatusBadge status={vm.state} /></td>
                      <td className="py-3 px-4 text-slate-300">{vm.os_name}</td>
                      <td className="py-3 px-4 text-slate-400">{vm.vcpu} vCPU / {vm.memory_mb} MB</td>
                      <td className="py-3 px-4 text-slate-300 font-medium">{vm.total_disk_gb} GB</td>
                      <td className="py-3 px-4"><StatusBadge status={vm.compatibility_status} /></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Activities feed (1 col) */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-semibold text-slate-100">Recent Activities</h3>
              <p className="text-xs text-slate-400">Migration job log history</p>
            </div>
            <button
              onClick={() => onNavigate('history')}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1"
            >
              <span>History</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3 flex-1 overflow-y-auto">
            {d.recent_activities.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-xs italic">
                No recent migration operations.
              </div>
            ) : (
              d.recent_activities.map((act: any) => (
                <div
                  key={act.id}
                  onClick={() => onNavigate('history')}
                  className="p-3 bg-slate-950/50 border border-slate-800/80 rounded-xl hover:border-slate-700 transition cursor-pointer text-xs space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-200">{act.name}</span>
                    <StatusBadge status={act.status} />
                  </div>
                  <div className="flex items-center justify-between text-slate-400 text-[11px]">
                    <span>Phase: {act.phase}</span>
                    <span>{act.progress_pct}%</span>
                  </div>
                  {/* Progress Bar */}
                  <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        act.status === 'Completed'
                          ? 'bg-emerald-500'
                          : act.status === 'Failed'
                          ? 'bg-rose-500'
                          : 'bg-indigo-500'
                      }`}
                      style={{ width: `${act.progress_pct}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
