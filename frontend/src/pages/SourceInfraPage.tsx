import React, { useState } from 'react';
import {
  Server,
  Plus,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Key,
  Shield,
  Trash2,
  Edit,
  Layers,
  HelpCircle
} from 'lucide-react';
import { SourceInfrastructure } from '../types';
import { api } from '../api/client';
import { StatusBadge } from '../components/StatusBadge';
import { Modal } from '../components/Modal';

interface Props {
  sources: SourceInfrastructure[];
  onRefresh: () => void;
  onNavigateToVMs: () => void;
}

export const SourceInfraPage: React.FC<Props> = ({ sources, onRefresh, onNavigateToVMs }) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSource, setEditingSource] = useState<SourceInfrastructure | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [discoveringId, setDiscoveringId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<any | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: 'Ubuntu Lab Hypervisor',
    environment: 'Lab',
    platform: 'QEMU/KVM',
    host: '127.0.0.1',
    port: 22,
    username: 'manojb',
    auth_type: 'key',
    private_key: '~/.ssh/amaa_discovery',
    password: '',
    use_sudo: false,
    description: 'Local Ubuntu laptop running libvirt and QEMU/KVM',
  });

  const handleOpenAdd = () => {
    setEditingSource(null);
    setFormData({
      name: 'Ubuntu Lab Hypervisor',
      environment: 'Lab',
      platform: 'QEMU/KVM',
      host: '127.0.0.1',
      port: 22,
      username: 'manojb',
      auth_type: 'key',
      private_key: '~/.ssh/amaa_discovery',
      password: '',
      use_sudo: false,
      description: 'Local Ubuntu laptop running libvirt and QEMU/KVM',
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (s: SourceInfrastructure) => {
    setEditingSource(s);
    setFormData({
      name: s.name,
      environment: s.environment,
      platform: s.platform,
      host: s.host,
      port: s.port,
      username: s.username,
      auth_type: s.auth_type,
      private_key: '',
      password: '',
      use_sudo: s.use_sudo,
      description: s.description || '',
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    try {
      if (editingSource) {
        await api.updateSource(editingSource.id, formData);
      } else {
        await api.createSource(formData);
      }
      setModalOpen(false);
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save source');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this source infrastructure?')) return;
    try {
      await api.deleteSource(id);
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleTest = async (id: string) => {
    setTestingId(id);
    setTestResult(null);
    try {
      const res = await api.testSource(id);
      setTestResult(res);
      onRefresh();
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message,
        missing_prerequisites: [{
          component: 'API Error',
          issue: err.message,
          remediation: 'Check server logs for details'
        }]
      });
    } finally {
      setTestingId(null);
    }
  };

  const handleDiscover = async (id: string) => {
    setDiscoveringId(id);
    try {
      const res = await api.discoverVMs(id);
      alert(res.message);
      onRefresh();
      onNavigateToVMs();
    } catch (err: any) {
      alert(`Discovery failed: ${err.message}`);
    } finally {
      setDiscoveringId(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-100 tracking-tight">Source Infrastructure</h2>
          <p className="text-xs text-slate-400">
            Manage QEMU/KVM source hosts, verify libvirt prerequisites over SSH, and discover virtual machines.
          </p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/20 transition"
        >
          <Plus className="w-4 h-4" />
          <span>Add Source Host</span>
        </button>
      </div>

      {/* Diagnostics Card if test run */}
      {testResult && (
        <div className={`p-5 rounded-2xl border transition-all ${
          testResult.success
            ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-200'
            : 'bg-rose-950/20 border-rose-500/30 text-rose-200'
        }`}>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              {testResult.success ? (
                <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
              ) : (
                <XCircle className="w-6 h-6 text-rose-400 shrink-0" />
              )}
              <div>
                <h4 className="font-semibold text-sm">{testResult.message}</h4>
                {testResult.success && (
                  <div className="mt-2 text-xs text-slate-300 space-y-1">
                    <p><strong>Hypervisor:</strong> {testResult.hypervisor_hostname || 'localhost'} ({testResult.hypervisor_version || 'QEMU'})</p>
                    <p><strong>Libvirt Version:</strong> {testResult.libvirt_version || 'N/A'}</p>
                    <p><strong>Host CPU / RAM:</strong> {testResult.cpu_model || 'x86_64'} &bull; {testResult.total_memory_gb ? `${testResult.total_memory_gb} GB` : 'N/A'}</p>
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={() => setTestResult(null)}
              className="text-xs text-slate-400 hover:text-slate-200 px-2 py-1 rounded bg-slate-900 border border-slate-800"
            >
              Dismiss
            </button>
          </div>

          {/* Missing Prerequisites & Remediation instructions */}
          {testResult.missing_prerequisites && testResult.missing_prerequisites.length > 0 && (
            <div className="mt-4 pt-4 border-t border-rose-500/20 space-y-3">
              <h5 className="text-xs font-bold uppercase tracking-wider text-rose-400">Required Prerequisite Remediation:</h5>
              {testResult.missing_prerequisites.map((p: any, i: number) => (
                <div key={i} className="p-3 bg-slate-950/60 rounded-xl border border-rose-500/20 text-xs space-y-1">
                  <div className="font-semibold text-rose-300">{p.component}: {p.issue}</div>
                  <div className="text-slate-400 font-mono text-[11px] bg-slate-900 p-2 rounded border border-slate-800">
                    $ {p.remediation}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Sources Grid */}
      <div className="grid grid-cols-1 gap-4">
        {sources.length === 0 ? (
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-12 text-center text-slate-400 space-y-3">
            <Server className="w-10 h-10 mx-auto text-slate-600" />
            <p className="text-sm">No source hypervisors configured yet.</p>
            <button
              onClick={handleOpenAdd}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold"
            >
              Add Ubuntu QEMU/KVM Host
            </button>
          </div>
        ) : (
          sources.map((s) => (
            <div
              key={s.id}
              className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 transition-all hover:border-slate-700"
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-3">
                    <h3 className="text-base font-bold text-slate-100">{s.name}</h3>
                    <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                      {s.environment}
                    </span>
                    <StatusBadge status={s.status} />
                  </div>
                  <p className="text-xs text-slate-400">{s.description || 'No description provided'}</p>
                  
                  {/* Connection details */}
                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 pt-1">
                    <span><strong>Platform:</strong> {s.platform}</span>
                    <span>&bull;</span>
                    <span><strong>Host:</strong> {s.username}@{s.host}:{s.port}</span>
                    <span>&bull;</span>
                    <span><strong>Auth:</strong> {s.auth_type === 'key' ? 'SSH Key' : 'Password'}</span>
                    <span>&bull;</span>
                    <span><strong>Discovered VMs:</strong> <span className="text-indigo-400 font-semibold">{s.vm_count}</span></span>
                  </div>

                  {/* Hypervisor Specs if connected */}
                  {s.hypervisor_info?.hostname && (
                    <div className="mt-2 p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80 text-xs text-slate-300 flex flex-wrap gap-4">
                      <span><strong>Hypervisor Hostname:</strong> {s.hypervisor_info.hostname}</span>
                      {s.hypervisor_info.libvirt_version && (
                        <span><strong>libvirt:</strong> {s.hypervisor_info.libvirt_version}</span>
                      )}
                      {s.hypervisor_info.cpu_model && (
                        <span><strong>CPU:</strong> {s.hypervisor_info.cpu_model}</span>
                      )}
                      {s.hypervisor_info.total_memory_gb && (
                        <span><strong>Memory:</strong> {s.hypervisor_info.total_memory_gb} GB</span>
                      )}
                    </div>
                  )}

                  {s.error_message && (
                    <p className="text-xs text-rose-400 mt-1">
                      <strong>Last Error:</strong> {s.error_message}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleTest(s.id)}
                    disabled={testingId === s.id}
                    className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${testingId === s.id ? 'animate-spin text-indigo-400' : ''}`} />
                    <span>{testingId === s.id ? 'Testing...' : 'Test Connection'}</span>
                  </button>

                  <button
                    onClick={() => handleDiscover(s.id)}
                    disabled={discoveringId === s.id}
                    className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-sm transition disabled:opacity-50"
                  >
                    <Layers className={`w-3.5 h-3.5 ${discoveringId === s.id ? 'animate-spin' : ''}`} />
                    <span>{discoveringId === s.id ? 'Discovering...' : 'Discover VMs'}</span>
                  </button>

                  <button
                    onClick={() => handleOpenEdit(s)}
                    className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition"
                    title="Edit"
                  >
                    <Edit className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleDelete(s.id)}
                    className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 rounded-xl transition"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add / Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingSource ? 'Edit Source Infrastructure' : 'Add Source Infrastructure'}
        maxWidth="max-w-xl"
      >
        <form onSubmit={handleSave} className="space-y-4 text-xs">
          {errorMsg && (
            <div className="p-3 bg-rose-950/40 border border-rose-500/30 text-rose-300 rounded-xl">
              {errorMsg}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 font-semibold mb-1">Infrastructure Name</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-slate-400 font-semibold mb-1">Environment</label>
              <select
                value={formData.environment}
                onChange={(e) => setFormData({ ...formData, environment: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="Lab">Lab</option>
                <option value="Development">Development</option>
                <option value="Test">Test</option>
                <option value="Production">Production</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-slate-400 font-semibold mb-1">Host / IP Address</label>
              <input
                type="text"
                required
                value={formData.host}
                onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500"
                placeholder="127.0.0.1 or ubuntu-host"
              />
            </div>

            <div>
              <label className="block text-slate-400 font-semibold mb-1">SSH Port</label>
              <input
                type="number"
                required
                value={formData.port}
                onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) || 22 })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 font-semibold mb-1">SSH Username</label>
              <input
                type="text"
                required
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-slate-400 font-semibold mb-1">Authentication Method</label>
              <select
                value={formData.auth_type}
                onChange={(e) => setFormData({ ...formData, auth_type: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="key">SSH Private Key</option>
                <option value="password">Password</option>
              </select>
            </div>
          </div>

          {formData.auth_type === 'key' ? (
            <div>
              <label className="block text-slate-400 font-semibold mb-1">
                SSH Private Key (Path or OpenSSH / RSA Key Content)
              </label>
              <textarea
                rows={3}
                value={formData.private_key}
                onChange={(e) => setFormData({ ...formData, private_key: e.target.value })}
                placeholder="~/.ssh/amaa_discovery or paste -----BEGIN OPENSSH PRIVATE KEY-----"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 font-mono text-[11px] focus:outline-none focus:border-indigo-500"
              />
            </div>
          ) : (
            <div>
              <label className="block text-slate-400 font-semibold mb-1">SSH Password</label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>
          )}

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="use_sudo"
              checked={formData.use_sudo}
              onChange={(e) => setFormData({ ...formData, use_sudo: e.target.checked })}
              className="rounded bg-slate-950 border-slate-800 text-indigo-600 focus:ring-0"
            />
            <label htmlFor="use_sudo" className="text-slate-300 font-medium cursor-pointer">
              Use sudo for privileged disk commands (if required)
            </label>
          </div>

          <div>
            <label className="block text-slate-400 font-semibold mb-1">Description (Optional)</label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="pt-4 flex justify-end gap-2 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-semibold transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold shadow-md transition"
            >
              {editingSource ? 'Update Connection' : 'Save Connection'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
