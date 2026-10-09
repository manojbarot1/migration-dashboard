import React, { useState } from 'react';
import {
  Cloud,
  Plus,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Key,
  Shield,
  Trash2,
  Edit,
  Eye,
  EyeOff,
  Server,
  Network
} from 'lucide-react';
import { TargetInfrastructure, AWSVpc, AWSSubnet, AWSSecurityGroup } from '../types';
import { api } from '../api/client';
import { StatusBadge } from '../components/StatusBadge';
import { Modal } from '../components/Modal';

interface Props {
  targets: TargetInfrastructure[];
  onRefresh: () => void;
}

export const TargetInfraPage: React.FC<Props> = ({ targets, onRefresh }) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTarget, setEditingTarget] = useState<TargetInfrastructure | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<any | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Inspector state for VPCs & Subnets
  const [activeTarget, setActiveTarget] = useState<TargetInfrastructure | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<string>('us-east-1');
  const [vpcs, setVpcs] = useState<AWSVpc[]>([]);
  const [selectedVpcId, setSelectedVpcId] = useState<string>('');
  const [subnets, setSubnets] = useState<AWSSubnet[]>([]);
  const [securityGroups, setSecurityGroups] = useState<AWSSecurityGroup[]>([]);
  const [loadingResources, setLoadingResources] = useState<boolean>(false);

  // Form State
  const [formData, setFormData] = useState({
    name: 'AWS Migration Target',
    account_alias: 'Lab Account',
    access_key_id: '',
    secret_access_key: '',
    session_token: '',
    default_region: 'us-east-1',
    role_arn: '',
    description: 'Target AWS VPC and EC2 environment for cloud migration',
  });

  const handleOpenAdd = () => {
    setEditingTarget(null);
    setFormData({
      name: 'AWS Migration Target',
      account_alias: 'Production AWS',
      access_key_id: '',
      secret_access_key: '',
      session_token: '',
      default_region: 'us-east-1',
      role_arn: '',
      description: 'Target AWS account for VM migrations',
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (t: TargetInfrastructure) => {
    setEditingTarget(t);
    setFormData({
      name: t.name,
      account_alias: t.account_alias || '',
      access_key_id: t.access_key_id || '',
      secret_access_key: '', // never prefill secret for security
      session_token: '',
      default_region: t.default_region,
      role_arn: t.role_arn || '',
      description: t.description || '',
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    try {
      if (editingTarget) {
        await api.updateTarget(editingTarget.id, formData);
      } else {
        await api.createTarget(formData);
      }
      setModalOpen(false);
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save AWS target');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this AWS target connection?')) return;
    try {
      await api.deleteTarget(id);
      if (activeTarget?.id === id) setActiveTarget(null);
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleTest = async (id: string) => {
    setTestingId(id);
    setTestResult(null);
    try {
      const res = await api.testTarget(id);
      setTestResult(res);
      onRefresh();
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message,
        error: 'Network or Authentication Error'
      });
    } finally {
      setTestingId(null);
    }
  };

  const handleInspectResources = async (t: TargetInfrastructure) => {
    setActiveTarget(t);
    setSelectedRegion(t.default_region || 'us-east-1');
    setLoadingResources(true);
    try {
      const vpcList = await api.getTargetVPCs(t.id, t.default_region);
      setVpcs(vpcList);
      if (vpcList.length > 0) {
        setSelectedVpcId(vpcList[0].id);
        const [subnetList, sgList] = await Promise.all([
          api.getTargetSubnets(t.id, vpcList[0].id, t.default_region),
          api.getTargetSecurityGroups(t.id, vpcList[0].id, t.default_region),
        ]);
        setSubnets(subnetList);
        setSecurityGroups(sgList);
      } else {
        setSubnets([]);
        setSecurityGroups([]);
      }
    } catch (err: any) {
      // If error (e.g., credentials invalid or demo), use cached if available
      if (t.cached_vpcs?.length > 0) {
        setVpcs(t.cached_vpcs);
        setSubnets(t.cached_subnets || []);
        setSecurityGroups(t.cached_security_groups || []);
      }
    } finally {
      setLoadingResources(false);
    }
  };

  const handleVpcChange = async (vpcId: string) => {
    if (!activeTarget) return;
    setSelectedVpcId(vpcId);
    setLoadingResources(true);
    try {
      const [subnetList, sgList] = await Promise.all([
        api.getTargetSubnets(activeTarget.id, vpcId, selectedRegion),
        api.getTargetSecurityGroups(activeTarget.id, vpcId, selectedRegion),
      ]);
      setSubnets(subnetList);
      setSecurityGroups(sgList);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoadingResources(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-100 tracking-tight">Target Infrastructure (AWS)</h2>
          <p className="text-xs text-slate-400">
            Configure secure AWS authentication, discover VPCs, subnets, and security groups using Boto3.
          </p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/20 transition"
        >
          <Plus className="w-4 h-4" />
          <span>Add AWS Target</span>
        </button>
      </div>

      {/* Security Banner */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex items-center gap-3 text-xs text-slate-300">
        <Shield className="w-5 h-5 text-indigo-400 shrink-0" />
        <p>
          <strong className="text-slate-100">Security Guarantee:</strong> AWS secrets are encrypted on-disk using Fernet AES encryption and never stored in plaintext. Secrets are never exposed to browser storage, logs, or API responses.
        </p>
      </div>

      {/* Auth Test Result Notification */}
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
                    <p><strong>Account ID:</strong> {testResult.account_id}</p>
                    <p><strong>Authenticated ARN:</strong> {testResult.arn}</p>
                    <p><strong>User ID:</strong> {testResult.user_id}</p>
                  </div>
                )}
                {testResult.error && (
                  <p className="text-xs text-rose-300 mt-1 font-mono">{testResult.error}</p>
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
        </div>
      )}

      {/* Targets List */}
      <div className="grid grid-cols-1 gap-4">
        {targets.length === 0 ? (
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-12 text-center text-slate-400 space-y-3">
            <Cloud className="w-10 h-10 mx-auto text-slate-600" />
            <p className="text-sm">No AWS targets configured yet.</p>
            <button
              onClick={handleOpenAdd}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold"
            >
              Configure AWS Target
            </button>
          </div>
        ) : (
          targets.map((t) => (
            <div
              key={t.id}
              className={`bg-slate-900/70 border ${
                activeTarget?.id === t.id ? 'border-indigo-500/60' : 'border-slate-800'
              } rounded-2xl p-6 transition-all hover:border-slate-700`}
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-3">
                    <h3 className="text-base font-bold text-slate-100">{t.name}</h3>
                    {t.account_alias && (
                      <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                        {t.account_alias}
                      </span>
                    )}
                    <StatusBadge status={t.status} />
                  </div>
                  <p className="text-xs text-slate-400">{t.description || 'Target AWS cloud for EC2 workloads'}</p>

                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 pt-1">
                    <span><strong>Region:</strong> <span className="text-indigo-400">{t.default_region}</span></span>
                    <span>&bull;</span>
                    <span><strong>Access Key:</strong> <span className="font-mono">{t.masked_access_key || 'Not configured'}</span></span>
                    {t.account_id && (
                      <>
                        <span>&bull;</span>
                        <span><strong>Account ID:</strong> <span className="font-mono text-slate-200">{t.account_id}</span></span>
                      </>
                    )}
                    {t.caller_arn && (
                      <>
                        <span>&bull;</span>
                        <span><strong>Identity ARN:</strong> <span className="font-mono text-slate-300">{t.caller_arn}</span></span>
                      </>
                    )}
                  </div>

                  {t.error_message && (
                    <p className="text-xs text-rose-400 mt-1">
                      <strong>Last Error:</strong> {t.error_message}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleTest(t.id)}
                    disabled={testingId === t.id}
                    className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${testingId === t.id ? 'animate-spin text-indigo-400' : ''}`} />
                    <span>{testingId === t.id ? 'Verifying...' : 'Test STS Auth'}</span>
                  </button>

                  <button
                    onClick={() => handleInspectResources(t)}
                    className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-sm transition"
                  >
                    <Network className="w-3.5 h-3.5" />
                    <span>Discover Resources</span>
                  </button>

                  <button
                    onClick={() => handleOpenEdit(t)}
                    className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition"
                    title="Edit"
                  >
                    <Edit className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleDelete(t.id)}
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

      {/* Discovered AWS Resources Section */}
      {activeTarget && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Cloud className="w-5 h-5 text-indigo-400" />
                <span>AWS Resources for {activeTarget.name} ({selectedRegion})</span>
              </h3>
              <p className="text-xs text-slate-400">Live VPCs, subnets, and security groups discovered via AWS EC2 API</p>
            </div>
            <button
              onClick={() => handleInspectResources(activeTarget)}
              disabled={loadingResources}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 text-slate-300 hover:text-white rounded-lg text-xs font-medium border border-slate-700"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingResources ? 'animate-spin text-indigo-400' : ''}`} />
              <span>Refresh VPCs & Subnets</span>
            </button>
          </div>

          {/* VPC Selection */}
          <div className="space-y-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Discovered VPCs</h4>
            {vpcs.length === 0 ? (
              <div className="p-6 bg-slate-950/50 rounded-xl text-center text-slate-500 text-xs">
                {loadingResources ? 'Discovering VPCs in region...' : 'No VPCs found or AWS credentials pending configuration.'}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {vpcs.map((vpc) => (
                  <div
                    key={vpc.id}
                    onClick={() => handleVpcChange(vpc.id)}
                    className={`p-4 rounded-xl border text-xs cursor-pointer transition ${
                      selectedVpcId === vpc.id
                        ? 'bg-indigo-950/40 border-indigo-500/60 text-indigo-200'
                        : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-slate-100">{vpc.name || vpc.id}</span>
                      {vpc.is_default && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">Default</span>
                      )}
                    </div>
                    <p className="font-mono text-[11px] text-slate-400">{vpc.id}</p>
                    <p className="text-slate-400 mt-1">CIDR: {vpc.cidr_block}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Subnets Table */}
          {selectedVpcId && (
            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Subnets in VPC <span className="font-mono text-indigo-400">{selectedVpcId}</span>
              </h4>
              <div className="overflow-x-auto border border-slate-800 rounded-xl bg-slate-950/40">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900/60 text-slate-400 font-semibold border-b border-slate-800">
                    <tr>
                      <th className="py-2.5 px-4">Subnet ID</th>
                      <th className="py-2.5 px-4">CIDR Block</th>
                      <th className="py-2.5 px-4">Availability Zone</th>
                      <th className="py-2.5 px-4">Available IPs</th>
                      <th className="py-2.5 px-4">Public IP Mapping</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {subnets.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-slate-500">
                          {loadingResources ? 'Loading subnets...' : 'No subnets discovered in this VPC.'}
                        </td>
                      </tr>
                    ) : (
                      subnets.map((sub) => (
                        <tr key={sub.id} className="hover:bg-slate-800/40">
                          <td className="py-2.5 px-4 font-mono text-indigo-400 font-medium">{sub.id}</td>
                          <td className="py-2.5 px-4 font-mono text-slate-300">{sub.cidr_block}</td>
                          <td className="py-2.5 px-4 text-slate-300">{sub.availability_zone}</td>
                          <td className="py-2.5 px-4 text-emerald-400 font-medium">{sub.available_ips} IPs</td>
                          <td className="py-2.5 px-4 text-slate-400">
                            {sub.map_public_ip ? 'Auto-assign enabled' : 'Disabled'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Security Groups Table */}
          {selectedVpcId && (
            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Security Groups in VPC <span className="font-mono text-indigo-400">{selectedVpcId}</span>
              </h4>
              <div className="overflow-x-auto border border-slate-800 rounded-xl bg-slate-950/40">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900/60 text-slate-400 font-semibold border-b border-slate-800">
                    <tr>
                      <th className="py-2.5 px-4">Group ID</th>
                      <th className="py-2.5 px-4">Group Name</th>
                      <th className="py-2.5 px-4">Description</th>
                      <th className="py-2.5 px-4">Inbound Rules</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {securityGroups.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-6 text-center text-slate-500">
                          {loadingResources ? 'Loading security groups...' : 'No security groups found.'}
                        </td>
                      </tr>
                    ) : (
                      securityGroups.map((sg) => (
                        <tr key={sg.id} className="hover:bg-slate-800/40">
                          <td className="py-2.5 px-4 font-mono text-slate-300">{sg.id}</td>
                          <td className="py-2.5 px-4 font-medium text-slate-200">{sg.name}</td>
                          <td className="py-2.5 px-4 text-slate-400">{sg.description || 'No description'}</td>
                          <td className="py-2.5 px-4 text-slate-300">{sg.inbound_rules_count} rules</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add / Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingTarget ? 'Edit AWS Target Connection' : 'Add AWS Target Connection'}
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
              <label className="block text-slate-400 font-semibold mb-1">Target Name</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-slate-400 font-semibold mb-1">Account Alias</label>
              <input
                type="text"
                value={formData.account_alias}
                onChange={(e) => setFormData({ ...formData, account_alias: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500"
                placeholder="e.g. Production Lab"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 font-semibold mb-1">AWS Access Key ID</label>
              <input
                type="text"
                value={formData.access_key_id}
                onChange={(e) => setFormData({ ...formData, access_key_id: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 font-mono text-[11px] focus:outline-none focus:border-indigo-500"
                placeholder="AKIAIOSFODNN7EXAMPLE"
              />
            </div>

            <div>
              <label className="block text-slate-400 font-semibold mb-1">Default Region</label>
              <select
                value={formData.default_region}
                onChange={(e) => setFormData({ ...formData, default_region: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="us-east-1">us-east-1 (N. Virginia)</option>
                <option value="us-east-2">us-east-2 (Ohio)</option>
                <option value="us-west-1">us-west-1 (N. California)</option>
                <option value="us-west-2">us-west-2 (Oregon)</option>
                <option value="eu-west-1">eu-west-1 (Ireland)</option>
                <option value="eu-north-1">eu-north-1 (Stockholm)</option>
                <option value="eu-central-1">eu-central-1 (Frankfurt)</option>
                <option value="ap-southeast-1">ap-southeast-1 (Singapore)</option>
                <option value="ap-south-1">ap-south-1 (Mumbai)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-slate-400 font-semibold mb-1">
              AWS Secret Access Key {editingTarget && '(Leave empty to keep existing)'}
            </label>
            <input
              type="password"
              value={formData.secret_access_key}
              onChange={(e) => setFormData({ ...formData, secret_access_key: e.target.value })}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 font-mono text-[11px] focus:outline-none focus:border-indigo-500"
              placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
            />
          </div>

          <div>
            <label className="block text-slate-400 font-semibold mb-1">Optional Session Token (Temporary Credentials)</label>
            <input
              type="password"
              value={formData.session_token}
              onChange={(e) => setFormData({ ...formData, session_token: e.target.value })}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 font-mono text-[11px] focus:outline-none focus:border-indigo-500"
              placeholder="AQoDYXdzEJr1..."
            />
          </div>

          <div>
            <label className="block text-slate-400 font-semibold mb-1">Optional IAM Role ARN to Assume</label>
            <input
              type="text"
              value={formData.role_arn}
              onChange={(e) => setFormData({ ...formData, role_arn: e.target.value })}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 font-mono text-[11px] focus:outline-none focus:border-indigo-500"
              placeholder="arn:aws:iam::123456789012:role/VMMigrationRole"
            />
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
              {editingTarget ? 'Update Connection' : 'Save Connection'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
