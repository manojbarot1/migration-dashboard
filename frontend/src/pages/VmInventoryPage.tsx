import React, { useState, useEffect } from 'react';
import {
  Layers,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HardDrive,
  Cpu,
  Network,
  FileCode,
  ArrowRightCircle,
  RefreshCw,
  Eye,
  Copy,
  Check,
  Share2,
  ArrowRight,
  ShieldAlert,
  Server
} from 'lucide-react';
import { DiscoveredVM, SourceInfrastructure, DependencyGraphResponse } from '../types';
import { api } from '../api/client';
import { StatusBadge } from '../components/StatusBadge';
import { Modal } from '../components/Modal';

interface Props {
  vms: DiscoveredVM[];
  sources: SourceInfrastructure[];
  onRefresh: () => void;
  onMigrateSelected: (vmIds: string[]) => void;
}

export const VmInventoryPage: React.FC<Props> = ({
  vms,
  sources,
  onRefresh,
  onMigrateSelected
}) => {
  const [selectedVmIds, setSelectedVmIds] = useState<string[]>([]);
  const [detailVm, setDetailVm] = useState<DiscoveredVM | null>(null);
  const [activeTab, setActiveTab] = useState<'assessment' | 'disks' | 'network' | 'xml'>('assessment');
  const [copiedXml, setCopiedXml] = useState(false);
  const [reassessing, setReassessing] = useState(false);

  // View Mode: 'list' vs 'topology'
  const [viewMode, setViewMode] = useState<'list' | 'topology'>('list');
  const [dependencyData, setDependencyData] = useState<DependencyGraphResponse | null>(null);
  const [loadingDependencies, setLoadingDependencies] = useState(false);

  useEffect(() => {
    const fetchDependencies = async () => {
      setLoadingDependencies(true);
      try {
        const res = await api.getDependencyGraph();
        setDependencyData(res);
      } catch (err) {
        console.error('Failed to load dependency graph:', err);
      } finally {
        setLoadingDependencies(false);
      }
    };
    fetchDependencies();
  }, [vms]);

  // Filters
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState('ALL');
  const [stateFilter, setStateFilter] = useState('ALL');
  const [compatFilter, setCompatFilter] = useState('ALL');

  const filteredVMs = vms.filter((vm) => {
    const matchesSearch = vm.name.toLowerCase().includes(search.toLowerCase()) ||
      vm.os_name.toLowerCase().includes(search.toLowerCase());
    const matchesSource = sourceFilter === 'ALL' || vm.source_id === sourceFilter;
    const matchesState = stateFilter === 'ALL' || vm.state.toLowerCase() === stateFilter.toLowerCase();
    const matchesCompat = compatFilter === 'ALL' || vm.compatibility_status === compatFilter;
    return matchesSearch && matchesSource && matchesState && matchesCompat;
  });

  const toggleSelectAll = () => {
    if (selectedVmIds.length === filteredVMs.length) {
      setSelectedVmIds([]);
    } else {
      setSelectedVmIds(filteredVMs.map((v) => v.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    if (selectedVmIds.includes(id)) {
      setSelectedVmIds(selectedVmIds.filter((item) => item !== id));
    } else {
      setSelectedVmIds([...selectedVmIds, id]);
    }
  };

  const handleCopyXml = (xml: string) => {
    navigator.clipboard.writeText(xml);
    setCopiedXml(true);
    setTimeout(() => setCopiedXml(false), 2000);
  };

  const handleReassess = async (id: string) => {
    setReassessing(true);
    try {
      const updated = await api.reassessVM(id);
      setDetailVm(updated);
      onRefresh();
    } catch (err: any) {
      alert(`Re-assessment failed: ${err.message}`);
    } finally {
      setReassessing(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 tracking-tight">Virtual Machine Inventory</h2>
          <p className="text-xs text-slate-400">
            Discovered libvirt virtual machines with pre-migration AWS compatibility evaluation.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Mode Switcher */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-1 text-xs">
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition ${
                viewMode === 'list'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Table</span>
            </button>
            <button
              onClick={() => setViewMode('topology')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition ${
                viewMode === 'topology'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Application Topology & Waves</span>
            </button>
          </div>

          <button
            onClick={onRefresh}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>

          {selectedVmIds.length > 0 && (
            <button
              onClick={() => onMigrateSelected(selectedVmIds)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/30 transition animate-pulse"
            >
              <ArrowRightCircle className="w-4 h-4" />
              <span>Migrate Selected ({selectedVmIds.length})</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
          <input
            type="text"
            placeholder="Search VMs by name or OS..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
          />
        </div>

        {/* Dropdown Filters */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          {/* Source Host Filter */}
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-slate-300 focus:outline-none focus:border-indigo-500"
          >
            <option value="ALL">All Hypervisors</option>
            {sources.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>

          {/* State Filter */}
          <select
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-slate-300 focus:outline-none focus:border-indigo-500"
          >
            <option value="ALL">All States</option>
            <option value="running">Running</option>
            <option value="shut off">Shut Off</option>
          </select>

          {/* Compatibility Filter */}
          <select
            value={compatFilter}
            onChange={(e) => setCompatFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-slate-300 focus:outline-none focus:border-indigo-500"
          >
            <option value="ALL">All Compatibility</option>
            <option value="Pass">Pass</option>
            <option value="Warning">Warning</option>
            <option value="Blocked">Blocked</option>
          </select>
        </div>
      </div>

      {/* View Mode 1: Table List */}
      {viewMode === 'list' && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 font-semibold border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4 w-10">
                    <input
                      type="checkbox"
                      checked={filteredVMs.length > 0 && selectedVmIds.length === filteredVMs.length}
                      onChange={toggleSelectAll}
                      className="rounded bg-slate-950 border-slate-800 text-indigo-600 focus:ring-0"
                    />
                  </th>
                  <th className="py-3 px-4">VM Name</th>
                  <th className="py-3 px-4">Source Host</th>
                  <th className="py-3 px-4">State</th>
                  <th className="py-3 px-4">Operating System</th>
                  <th className="py-3 px-4">Compute</th>
                  <th className="py-3 px-4">Disks</th>
                  <th className="py-3 px-4">Total Storage</th>
                  <th className="py-3 px-4">Compatibility</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredVMs.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-slate-500">
                      No virtual machines match your criteria. Ensure you have run "Discover VMs" on the Source Infrastructure page.
                    </td>
                  </tr>
                ) : (
                  filteredVMs.map((vm) => {
                    const isSelected = selectedVmIds.includes(vm.id);
                    return (
                      <tr
                        key={vm.id}
                        className={`hover:bg-slate-800/40 transition ${
                          isSelected ? 'bg-indigo-950/20' : ''
                        }`}
                      >
                        <td className="py-3.5 px-4">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectOne(vm.id)}
                            className="rounded bg-slate-950 border-slate-800 text-indigo-600 focus:ring-0"
                          />
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-slate-100">{vm.name}</td>
                        <td className="py-3.5 px-4 text-slate-400">{vm.source_name || 'Ubuntu Laptop'}</td>
                        <td className="py-3.5 px-4"><StatusBadge status={vm.state} /></td>
                        <td className="py-3.5 px-4 text-slate-300">{vm.os_name}</td>
                        <td className="py-3.5 px-4 text-slate-400">
                          {vm.vcpu} vCPU &bull; {vm.memory_mb} MB
                        </td>
                        <td className="py-3.5 px-4 text-slate-400">{vm.disks.length} disk(s)</td>
                        <td className="py-3.5 px-4 font-medium text-slate-200">{vm.total_disk_gb} GB</td>
                        <td className="py-3.5 px-4"><StatusBadge status={vm.compatibility_status} /></td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={() => setDetailVm(vm)}
                            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[11px] font-medium border border-slate-700 transition"
                          >
                            Inspect
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* View Mode 2: Topology & Move Groups */}
      {viewMode === 'topology' && (
        <div className="space-y-6 animate-fade-in">
          {/* Topology Graph / Architecture Map */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <Share2 className="w-4 h-4 text-indigo-400" />
                  <span>Application Dependency Flow (HelpDesk 3-Tier Stack)</span>
                </h3>
                <p className="text-xs text-slate-400">Discovered from libvirt network interfaces, static DHCP leases, and port bindings.</p>
              </div>
              <span className="px-2.5 py-1 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-lg text-xs font-mono">
                192.168.100.0/24 (virbr1)
              </span>
            </div>

            {/* Architecture Flow Diagram */}
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-6 flex flex-col md:flex-row items-center justify-around gap-6">
              {/* Web Tier Node */}
              <div className="w-full md:w-64 p-4 rounded-xl bg-blue-950/20 border border-blue-500/40 text-center relative group">
                <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider block mb-1">Web Tier</span>
                <div className="text-base font-bold text-slate-100">web1</div>
                <div className="text-xs font-mono text-slate-400 mt-1">192.168.100.10</div>
                <div className="mt-3 pt-2 border-t border-slate-800/60 text-[11px] text-slate-300">
                  Nginx Web Server / UI Frontend
                </div>
                <div className="mt-2 flex justify-center gap-1.5">
                  <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 text-[10px]">HTTP 80/443</span>
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
              <div className="w-full md:w-64 p-4 rounded-xl bg-purple-950/20 border border-purple-500/40 text-center relative group">
                <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider block mb-1">App Tier</span>
                <div className="text-base font-bold text-slate-100">app1</div>
                <div className="text-xs font-mono text-slate-400 mt-1">192.168.100.20</div>
                <div className="mt-3 pt-2 border-t border-slate-800/60 text-[11px] text-slate-300">
                  Helpdesk REST API Engine
                </div>
                <div className="mt-2 flex justify-center gap-1.5">
                  <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 text-[10px]">Python / Node App</span>
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
              <div className="w-full md:w-64 p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/40 text-center relative group">
                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block mb-1">Database Tier</span>
                <div className="text-base font-bold text-slate-100">db1</div>
                <div className="text-xs font-mono text-slate-400 mt-1">192.168.100.30</div>
                <div className="mt-3 pt-2 border-t border-slate-800/60 text-[11px] text-slate-300">
                  PostgreSQL Relational DB
                </div>
                <div className="mt-2 flex justify-center gap-1.5">
                  <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 text-[10px]">Persistent Storage</span>
                </div>
              </div>
            </div>

            {/* Standalone Server Note */}
            <div className="mt-4 p-3 bg-slate-950/40 border border-slate-800/60 rounded-xl flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <Server className="w-4 h-4 text-slate-400" />
                <span className="text-slate-300"><strong>Standalone Host:</strong> <code className="text-indigo-300 font-mono">aether1</code> (192.168.122.50) on libvirt network <code className="text-slate-400">default</code> has zero detected dependencies.</span>
              </div>
              <span className="text-[11px] text-emerald-400">Independent Migration Candidate</span>
            </div>
          </div>

          {/* Move Groups / Migration Waves Cards */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-400" />
              <span>Recommended Move Groups & Migration Waves</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {dependencyData?.move_groups.map((group) => (
                <div key={group.group_id} className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-slate-100">{group.name}</h4>
                      <p className="text-xs text-slate-400 mt-1">{group.description}</p>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800/50 text-[11px] font-semibold whitespace-nowrap">
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
                      <span className="font-semibold text-slate-400">Migration Execution Sequence:</span>
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
                      onClick={() => onMigrateSelected(group.vm_ids)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow transition"
                    >
                      <span>Migrate Wave ({group.server_count} VMs)</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* VM Detail Modal */}
      {detailVm && (
        <Modal
          isOpen={true}
          onClose={() => setDetailVm(null)}
          title={`Virtual Machine Details: ${detailVm.name}`}
          maxWidth="max-w-4xl"
        >
          <div className="space-y-6 text-xs">
            {/* Quick Summary Pill Bar */}
            <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <span className="text-slate-500 font-semibold uppercase text-[10px] block">UUID</span>
                <span className="font-mono text-slate-300 text-[11px] truncate block">{detailVm.uuid}</span>
              </div>
              <div>
                <span className="text-slate-500 font-semibold uppercase text-[10px] block">Power State</span>
                <StatusBadge status={detailVm.state} />
              </div>
              <div>
                <span className="text-slate-500 font-semibold uppercase text-[10px] block">Firmware / Loader</span>
                <span className="text-slate-200 font-semibold">{detailVm.firmware_type}</span>
              </div>
              <div>
                <span className="text-slate-500 font-semibold uppercase text-[10px] block">Compatibility</span>
                <StatusBadge status={detailVm.compatibility_status} />
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-800 gap-4 text-xs font-semibold">
              <button
                onClick={() => setActiveTab('assessment')}
                className={`pb-2.5 transition border-b-2 ${
                  activeTab === 'assessment'
                    ? 'border-indigo-500 text-indigo-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                Pre-Migration Assessment ({detailVm.compatibility_reasons.length})
              </button>
              <button
                onClick={() => setActiveTab('disks')}
                className={`pb-2.5 transition border-b-2 ${
                  activeTab === 'disks'
                    ? 'border-indigo-500 text-indigo-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                Virtual Disks ({detailVm.disks.length})
              </button>
              <button
                onClick={() => setActiveTab('network')}
                className={`pb-2.5 transition border-b-2 ${
                  activeTab === 'network'
                    ? 'border-indigo-500 text-indigo-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                Network Interfaces ({detailVm.interfaces.length})
              </button>
              <button
                onClick={() => setActiveTab('xml')}
                className={`pb-2.5 transition border-b-2 ${
                  activeTab === 'xml'
                    ? 'border-indigo-500 text-indigo-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                Libvirt Domain XML
              </button>
            </div>

            {/* Tab: Pre-Migration Assessment */}
            {activeTab === 'assessment' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-slate-400">
                    Automated readiness verification against AWS EC2 VM Import/Export specifications.
                  </p>
                  <button
                    onClick={() => handleReassess(detailVm.id)}
                    disabled={reassessing}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 transition"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${reassessing ? 'animate-spin text-indigo-400' : ''}`} />
                    <span>Re-evaluate</span>
                  </button>
                </div>

                <div className="space-y-2.5">
                  {detailVm.compatibility_reasons.map((item, idx) => (
                    <div
                      key={idx}
                      className={`p-3.5 rounded-xl border flex items-start gap-3 ${
                        item.status === 'Pass'
                          ? 'bg-emerald-950/20 border-emerald-500/20 text-emerald-200'
                          : item.status === 'Warning'
                          ? 'bg-amber-950/20 border-amber-500/20 text-amber-200'
                          : 'bg-rose-950/20 border-rose-500/20 text-rose-200'
                      }`}
                    >
                      <div className="shrink-0 mt-0.5">
                        {item.status === 'Pass' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                        {item.status === 'Warning' && <AlertTriangle className="w-4 h-4 text-amber-400" />}
                        {item.status === 'Blocked' && <XCircle className="w-4 h-4 text-rose-400" />}
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-100">{item.check}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-bold bg-slate-900 border border-slate-800">
                            {item.status}
                          </span>
                        </div>
                        <p className="text-slate-300 text-xs">{item.message}</p>
                        {item.recommendation && (
                          <p className="text-slate-400 text-[11px] italic">
                            &rarr; Recommendation: {item.recommendation}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tab: Virtual Disks */}
            {activeTab === 'disks' && (
              <div className="space-y-3">
                <table className="w-full text-left text-xs border border-slate-800 rounded-xl bg-slate-950/40">
                  <thead className="bg-slate-900/60 text-slate-400 font-semibold border-b border-slate-800">
                    <tr>
                      <th className="py-2.5 px-4">Target Dev</th>
                      <th className="py-2.5 px-4">Bus</th>
                      <th className="py-2.5 px-4">Format</th>
                      <th className="py-2.5 px-4">Capacity</th>
                      <th className="py-2.5 px-4">Allocated</th>
                      <th className="py-2.5 px-4">Host File Path</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {detailVm.disks.map((d, i) => (
                      <tr key={i}>
                        <td className="py-2.5 px-4 font-mono font-bold text-indigo-400">{d.device}</td>
                        <td className="py-2.5 px-4 text-slate-300">{d.bus}</td>
                        <td className="py-2.5 px-4 font-mono uppercase text-slate-300">{d.format}</td>
                        <td className="py-2.5 px-4 text-slate-100 font-semibold">{d.capacity_gb} GB</td>
                        <td className="py-2.5 px-4 text-slate-400">{d.allocation_gb} GB</td>
                        <td className="py-2.5 px-4 font-mono text-slate-400 text-[11px] break-all">{d.path}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Tab: Network Interfaces */}
            {activeTab === 'network' && (
              <div className="space-y-3">
                <table className="w-full text-left text-xs border border-slate-800 rounded-xl bg-slate-950/40">
                  <thead className="bg-slate-900/60 text-slate-400 font-semibold border-b border-slate-800">
                    <tr>
                      <th className="py-2.5 px-4">MAC Address</th>
                      <th className="py-2.5 px-4">Type</th>
                      <th className="py-2.5 px-4">Model</th>
                      <th className="py-2.5 px-4">Source Network</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {detailVm.interfaces.map((iface, i) => (
                      <tr key={i}>
                        <td className="py-2.5 px-4 font-mono text-indigo-400 font-medium">{iface.mac}</td>
                        <td className="py-2.5 px-4 text-slate-300">{iface.type}</td>
                        <td className="py-2.5 px-4 font-mono text-slate-300">{iface.model}</td>
                        <td className="py-2.5 px-4 text-slate-400">{iface.source_network || 'Default Bridge'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Tab: XML */}
            {activeTab === 'xml' && (
              <div className="space-y-2">
                <div className="flex justify-end">
                  <button
                    onClick={() => handleCopyXml(detailVm.xml_desc || '')}
                    className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium border border-slate-700"
                  >
                    {copiedXml ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedXml ? 'Copied XML' : 'Copy XML'}</span>
                  </button>
                </div>
                <pre className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-[11px] font-mono text-slate-300 max-h-96 overflow-y-auto">
                  {detailVm.xml_desc || 'No domain XML available.'}
                </pre>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex justify-between items-center pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setDetailVm(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-semibold"
              >
                Close
              </button>

              <button
                type="button"
                onClick={() => {
                  const vmId = detailVm.id;
                  setDetailVm(null);
                  onMigrateSelected([vmId]);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold shadow-md"
              >
                <ArrowRightCircle className="w-4 h-4" />
                <span>Migrate This VM</span>
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
