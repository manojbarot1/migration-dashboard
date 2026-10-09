import React, { useState, useEffect } from 'react';
import {
  History,
  RefreshCw,
  Search,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Terminal,
  StopCircle,
  RotateCcw
} from 'lucide-react';
import { MigrationJob } from '../types';
import { api } from '../api/client';
import { StatusBadge } from '../components/StatusBadge';
import { Modal } from '../components/Modal';
import { LogsViewer } from '../components/LogsViewer';

interface Props {
  onRefresh: () => void;
}

export const MigrationHistoryPage: React.FC<Props> = ({ onRefresh }) => {
  const [jobs, setJobs] = useState<MigrationJob[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedJob, setSelectedJob] = useState<MigrationJob | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [search, setSearch] = useState<string>('');

  const loadJobs = async () => {
    setLoading(true);
    try {
      const data = await api.listMigrationJobs();
      setJobs(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadJobs();
    const interval = setInterval(loadJobs, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleCancel = async (id: string) => {
    if (!confirm('Are you sure you want to cancel this migration job?')) return;
    try {
      await api.cancelMigrationJob(id);
      loadJobs();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleRetry = async (id: string) => {
    try {
      const updated = await api.retryMigrationJob(id);
      setSelectedJob(updated);
      loadJobs();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const filteredJobs = jobs.filter((j) => {
    const matchesSearch = j.vm_name.toLowerCase().includes(search.toLowerCase()) ||
      (j.created_instance_id && j.created_instance_id.toLowerCase().includes(search.toLowerCase())) ||
      j.name.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || j.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 tracking-tight">Migration Job History & Resources</h2>
          <p className="text-xs text-slate-400">
            Persistent audit history of all migration tasks, generated AWS resources, and timestamped logs.
          </p>
        </div>

        <button
          onClick={loadJobs}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
          <span>Refresh Jobs</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
          <input
            type="text"
            placeholder="Search by VM name or EC2 instance ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-slate-300 text-xs focus:outline-none focus:border-indigo-500"
        >
          <option value="ALL">All Statuses</option>
          <option value="Completed">Completed</option>
          <option value="Failed">Failed</option>
          <option value="Cancelled">Cancelled</option>
          <option value="Executing">In Progress</option>
        </select>
      </div>

      {/* Jobs Table */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 font-semibold border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Source VM</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Current Phase</th>
                <th className="py-3 px-4">Progress</th>
                <th className="py-3 px-4">Target EC2 Instance</th>
                <th className="py-3 px-4">Region</th>
                <th className="py-3 px-4">Started At</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredJobs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    No migration jobs found. Launch your first migration using the Migration Execution Wizard.
                  </td>
                </tr>
              ) : (
                filteredJobs.map((job) => (
                  <tr key={job.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3.5 px-4 font-semibold text-slate-100">{job.vm_name}</td>
                    <td className="py-3.5 px-4"><StatusBadge status={job.status} /></td>
                    <td className="py-3.5 px-4 text-slate-300">{job.phase}</td>
                    <td className="py-3.5 px-4 font-mono font-medium text-indigo-400">{job.progress_pct}%</td>
                    <td className="py-3.5 px-4 font-mono text-emerald-400 font-medium">
                      {job.created_instance_id || '-'}
                    </td>
                    <td className="py-3.5 px-4 text-slate-400">{job.target_region}</td>
                    <td className="py-3.5 px-4 text-slate-400">
                      {job.start_time ? new Date(job.start_time).toLocaleString() : '-'}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => setSelectedJob(job)}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[11px] font-medium border border-slate-700 transition"
                      >
                        Details & Logs
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Job Details Modal */}
      {selectedJob && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedJob(null)}
          title={`Migration Job: ${selectedJob.name}`}
          maxWidth="max-w-4xl"
        >
          <div className="space-y-6 text-xs">
            {/* Status & Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-slate-950/60 border border-slate-800 rounded-xl">
              <div>
                <span className="text-slate-500 font-semibold uppercase text-[10px] block">Status</span>
                <StatusBadge status={selectedJob.status} />
              </div>
              <div>
                <span className="text-slate-500 font-semibold uppercase text-[10px] block">Phase</span>
                <span className="text-slate-200 font-semibold">{selectedJob.phase}</span>
              </div>
              <div>
                <span className="text-slate-500 font-semibold uppercase text-[10px] block">Progress</span>
                <span className="font-mono text-indigo-400 font-bold text-sm">{selectedJob.progress_pct}%</span>
              </div>
              <div>
                <span className="text-slate-500 font-semibold uppercase text-[10px] block">Duration</span>
                <span className="text-slate-300">
                  {selectedJob.start_time && selectedJob.end_time
                    ? `${Math.round((new Date(selectedJob.end_time).getTime() - new Date(selectedJob.start_time).getTime()) / 1000)}s`
                    : 'Running...'}
                </span>
              </div>
            </div>

            {/* Created Cloud Resources Inventory */}
            {selectedJob.created_instance_id && (
              <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl space-y-2">
                <h4 className="font-semibold uppercase tracking-wider text-[11px] text-emerald-400">
                  Created AWS Resources Inventory
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-slate-300">
                  <div>
                    <span className="text-slate-500 text-[10px] block">EC2 Instance</span>
                    <span className="font-mono text-emerald-300 font-semibold">{selectedJob.created_instance_id}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] block">AMI ID</span>
                    <span className="font-mono text-slate-200">{selectedJob.created_ami_id || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] block">VPC ID</span>
                    <span className="font-mono text-slate-300">{selectedJob.target_vpc_id || 'default'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] block">Subnet ID</span>
                    <span className="font-mono text-slate-300">{selectedJob.target_subnet_id || 'default'}</span>
                  </div>
                </div>

                {selectedJob.validation_results?.validation_summary && (
                  <p className="text-[11px] text-slate-300 pt-2 border-t border-slate-800">
                    <strong>Validation Summary:</strong> {selectedJob.validation_results.validation_summary}
                  </p>
                )}
              </div>
            )}

            {/* Error Message if any */}
            {selectedJob.error_message && (
              <div className="p-4 bg-rose-950/30 border border-rose-500/30 rounded-xl text-rose-300">
                <strong>Error:</strong> {selectedJob.error_message}
              </div>
            )}

            {/* Execution Logs */}
            <LogsViewer logs={selectedJob.logs || []} />

            {/* Controls */}
            <div className="flex justify-between items-center pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setSelectedJob(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-semibold"
              >
                Close
              </button>

              <div className="flex items-center gap-2">
                {['Pending', 'Validating', 'Preparing source', 'Exporting disks', 'Uploading disks', 'Importing image', 'Launching EC2', 'Validating target'].includes(selectedJob.status) && (
                  <button
                    onClick={() => handleCancel(selectedJob.id)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-500/30 rounded-xl font-semibold transition"
                  >
                    <StopCircle className="w-4 h-4" />
                    <span>Cancel Job</span>
                  </button>
                )}

                {['Failed', 'Cancelled'].includes(selectedJob.status) && selectedJob.can_retry && (
                  <button
                    onClick={() => handleRetry(selectedJob.id)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold shadow-md transition"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Retry Execution</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
