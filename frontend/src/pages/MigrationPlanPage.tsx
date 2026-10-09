import React, { useState, useEffect } from 'react';
import {
  ClipboardList,
  Server,
  Cloud,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ShieldAlert,
  RefreshCw,
  HardDrive,
  Cpu,
  Layers,
  Network,
  Globe,
  Lock,
  Database
} from 'lucide-react';
import {
  DiscoveredVM,
  TargetInfrastructure,
  SourceInfrastructure,
  AWSVpc,
  AWSSubnet,
  AWSSecurityGroup,
  MoveGroup
} from '../types';
import { api } from '../api/client';
import { StatusBadge } from '../components/StatusBadge';

interface ServerConfig {
  vmId: string;
  vmName: string;
  tier: string;
  subnetId: string;
  securityGroupIds: string[];
  instanceType: string;
  diskType: string;
  diskSizeGb: number;
  assignPublicIp: boolean;
  privateIpOption: 'dynamic' | 'preserve' | 'dns';
  preservedIp?: string;
  privateDnsName?: string;
}

interface Props {
  vms: DiscoveredVM[];
  sources: SourceInfrastructure[];
  targets: TargetInfrastructure[];
  preselectedVmIds: string[];
  onStartExecution: (configs: Record<string, ServerConfig>, commonTarget: { targetId: string; region: string; vpcId: string }) => void;
}

export const MigrationPlanPage: React.FC<Props> = ({
  vms,
  sources,
  targets,
  preselectedVmIds,
  onStartExecution
}) => {
  // Common Destination Target
  const [targetId, setTargetId] = useState<string>(targets[0]?.id || '');
  const [targetRegion, setTargetRegion] = useState<string>(targets[0]?.default_region || 'eu-central-1');
  const [vpcs, setVpcs] = useState<AWSVpc[]>([]);
  const [selectedVpcId, setSelectedVpcId] = useState<string>('');
  const [subnets, setSubnets] = useState<AWSSubnet[]>([]);
  const [securityGroups, setSecurityGroups] = useState<AWSSecurityGroup[]>([]);
  const [loadingNetwork, setLoadingNetwork] = useState(false);

  // Selected VMs to Plan
  const [selectedVmIds, setSelectedVmIds] = useState<string[]>(
    preselectedVmIds?.length > 0 ? preselectedVmIds : vms.map((v) => v.id)
  );

  // Per-Server Configurations
  const [serverConfigs, setServerConfigs] = useState<Record<string, ServerConfig>>({});
  const [activeTab, setActiveTab] = useState<'architecture' | 'servers' | 'postmigration' | 'review'>('architecture');

  // Load VPCs and Subnets with real Refresh action
  const loadNetworkResources = async () => {
    if (!targetId) return;
    setLoadingNetwork(true);
    try {
      const vpcList = await api.getTargetVPCs(targetId, targetRegion);
      setVpcs(vpcList);
      if (vpcList.length > 0) {
        const vpcId = selectedVpcId && vpcList.some((v) => v.id === selectedVpcId) ? selectedVpcId : vpcList[0].id;
        setSelectedVpcId(vpcId);
        const [subList, sgList] = await Promise.all([
          api.getTargetSubnets(targetId, vpcId, targetRegion),
          api.getTargetSecurityGroups(targetId, vpcId, targetRegion),
        ]);
        setSubnets(subList);
        setSecurityGroups(sgList);
      } else {
        setSelectedVpcId('');
        setSubnets([]);
        setSecurityGroups([]);
      }
    } catch (err) {
      console.error('Failed to load network resources:', err);
    } finally {
      setLoadingNetwork(false);
    }
  };

  useEffect(() => {
    loadNetworkResources();
  }, [targetId, targetRegion]);

  // When VPC changes, load subnets
  const handleVpcChange = async (vpcId: string) => {
    setSelectedVpcId(vpcId);
    setLoadingNetwork(true);
    try {
      const [subList, sgList] = await Promise.all([
        api.getTargetSubnets(targetId, vpcId, targetRegion),
        api.getTargetSecurityGroups(targetId, vpcId, targetRegion),
      ]);
      setSubnets(subList);
      setSecurityGroups(sgList);
    } catch (err) {
      console.error('Failed to load subnets:', err);
    } finally {
      setLoadingNetwork(false);
    }
  };

  // Initialize or update server configs when VMs or subnets change
  useEffect(() => {
    const updated = { ...serverConfigs };
    selectedVmIds.forEach((id) => {
      const vm = vms.find((v) => v.id === id);
      if (!vm) return;
      if (!updated[id]) {
        // Auto-assign tier based on name
        let tier = 'Standalone';
        let defaultSubnet = subnets[0]?.id || '';
        let publicIp = false;
        let pIp = '192.168.100.10';

        if (vm.name.includes('web')) {
          tier = 'Web Tier (Public Subnet)';
          publicIp = true;
          pIp = '192.168.100.10';
          // Prefer public subnet if exists
          const pub = subnets.find((s) => s.map_public_ip) || subnets[0];
          defaultSubnet = pub?.id || '';
        } else if (vm.name.includes('app')) {
          tier = 'App Tier (Private Subnet)';
          pIp = '192.168.100.20';
          defaultSubnet = subnets[1]?.id || subnets[0]?.id || '';
        } else if (vm.name.includes('db')) {
          tier = 'Database Tier (Isolated Private Subnet)';
          pIp = '192.168.100.30';
          defaultSubnet = subnets[2]?.id || subnets[0]?.id || '';
        }

        updated[id] = {
          vmId: id,
          vmName: vm.name,
          tier,
          subnetId: defaultSubnet,
          securityGroupIds: securityGroups[0] ? [securityGroups[0].id] : [],
          instanceType: 't3.small',
          diskType: 'gp3',
          diskSizeGb: Math.max(Math.round(vm.total_disk_gb), 50),
          assignPublicIp: publicIp,
          privateIpOption: 'dns',
          preservedIp: pIp,
          privateDnsName: `${vm.name}.internal`
        };
      } else if (!updated[id].subnetId && subnets.length > 0) {
        updated[id].subnetId = subnets[0].id;
      }
    });
    setServerConfigs(updated);
  }, [selectedVmIds, vms, subnets, securityGroups]);

  const updateServerField = (vmId: string, field: keyof ServerConfig, val: any) => {
    setServerConfigs((prev) => ({
      ...prev,
      [vmId]: {
        ...prev[vmId],
        [field]: val
      }
    }));
  };

  const handleLaunchMigration = () => {
    if (!selectedVpcId) {
      alert('Please select a target AWS VPC.');
      return;
    }
    onStartExecution(serverConfigs, {
      targetId,
      region: targetRegion,
      vpcId: selectedVpcId
    });
  };

  return (
    <div className="space-y-6 animate-fade-in text-xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 tracking-tight flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-indigo-400" />
            <span>Comprehensive Migration Plan & Target Architecture</span>
          </h2>
          <p className="text-xs text-slate-400">
            Per-server subnet placement, IP resolution strategies, and automated post-migration validation checks.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleLaunchMigration}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold shadow-lg shadow-indigo-600/30 transition"
          >
            <span>Proceed to Migration Execution</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Target Cloud & Region Selector with Refresh Button */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Cloud className="w-4 h-4 text-indigo-400" />
            <span className="font-bold text-slate-200">AWS Target Environment & Network Discovery</span>
          </div>
          <button
            onClick={loadNetworkResources}
            disabled={loadingNetwork}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingNetwork ? 'animate-spin text-indigo-400' : ''}`} />
            <span>Refresh VPCs & Subnets</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-slate-400 mb-1 font-semibold">AWS Target Connection</label>
            <select
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
            >
              {targets.map((t) => (
                <option key={t.id} value={t.id}>{t.name} ({t.account_id || 'Active'})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-400 mb-1 font-semibold">Destination Region</label>
            <select
              value={targetRegion}
              onChange={(e) => setTargetRegion(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
            >
              <option value="eu-central-1">eu-central-1 (Frankfurt) - Active VPC available</option>
              <option value="us-east-1">us-east-1 (N. Virginia) - Active VPC available</option>
              <option value="us-east-2">us-east-2 (Ohio) - Active VPC available</option>
              <option value="eu-west-1">eu-west-1 (Ireland)</option>
              <option value="eu-north-1">eu-north-1 (Stockholm)</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-400 mb-1 font-semibold">Target AWS VPC</label>
            <select
              value={selectedVpcId}
              onChange={(e) => handleVpcChange(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
            >
              {vpcs.length === 0 ? (
                <option value="">No VPC found in {targetRegion}</option>
              ) : (
                vpcs.map((v) => (
                  <option key={v.id} value={v.id}>{v.name || v.id} ({v.cidr_block})</option>
                ))
              )}
            </select>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        {[
          { id: 'architecture', label: '1. Recommended 3-Tier Architecture', icon: Layers },
          { id: 'servers', label: '2. Per-Server Subnet & IP Mapping', icon: Server },
          { id: 'postmigration', label: '3. Post-Migration IP Resolution & Health', icon: Globe },
          { id: 'review', label: '4. Migration Wave Execution Review', icon: CheckCircle2 },
        ].map((t) => {
          const Icon = t.icon;
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl font-medium transition ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: 3-TIER ARCHITECTURE RECOMMENDATION */}
      {activeTab === 'architecture' && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-6">
          <div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-400" />
              <span>Best-Practice AWS 3-Tier Network Isolation Architecture</span>
            </h3>
            <p className="text-slate-400 mt-1">
              In your on-prem KVM lab, all VMs share a single flat subnet without internal firewalls. In AWS, splitting workloads across 3 isolated subnets prevents data exposure:
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Tier 1 */}
            <div className="p-4 bg-blue-950/20 border border-blue-500/40 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-blue-400 font-bold">
                <Globe className="w-4 h-4" />
                <span>Tier 1: Public Subnet (Web)</span>
              </div>
              <p className="text-slate-300 text-[11px]">
                Hosts <strong>web1</strong> or AWS Application Load Balancers. Only ports 80/443 exposed to the internet.
              </p>
              <div className="p-2 bg-slate-950/80 rounded border border-slate-800 text-[10px] font-mono text-slate-300">
                Security Group: Inbound 80/443 from 0.0.0.0/0
              </div>
            </div>

            {/* Tier 2 */}
            <div className="p-4 bg-purple-950/20 border border-purple-500/40 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-purple-400 font-bold">
                <Server className="w-4 h-4" />
                <span>Tier 2: Private Subnet (App)</span>
              </div>
              <p className="text-slate-300 text-[11px]">
                Hosts <strong>app1</strong> business logic. No public IP address. Accessible only from Web Tier.
              </p>
              <div className="p-2 bg-slate-950/80 rounded border border-slate-800 text-[10px] font-mono text-slate-300">
                Security Group: Inbound 8080 from Web-SG ONLY
              </div>
            </div>

            {/* Tier 3 */}
            <div className="p-4 bg-emerald-950/20 border border-emerald-500/40 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-emerald-400 font-bold">
                <Database className="w-4 h-4" />
                <span>Tier 3: Isolated Subnet (Database)</span>
              </div>
              <p className="text-slate-300 text-[11px]">
                Hosts <strong>db1</strong> PostgreSQL. Completely isolated from the internet and Web tier.
              </p>
              <div className="p-2 bg-slate-950/80 rounded border border-slate-800 text-[10px] font-mono text-slate-300">
                Security Group: Inbound 5432 from App-SG ONLY
              </div>
            </div>
          </div>

          <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl flex items-center justify-between">
            <span className="text-slate-300">
              Configure each server's specific target subnet and security group in <strong>Tab 2 (Per-Server Subnet Mapping)</strong>.
            </span>
            <button
              onClick={() => setActiveTab('servers')}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-semibold flex items-center gap-1.5"
            >
              <span>Customize Server Placements</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* TAB 2: PER-SERVER SUBNET & IP MAPPING */}
      {activeTab === 'servers' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-100">Server-Wise AWS Resource Placement</h3>
              <p className="text-slate-400">Assign each virtual machine to its own AWS Subnet, Security Group, and EC2 Instance Type.</p>
            </div>
          </div>

          <div className="space-y-4">
            {selectedVmIds.map((vmId) => {
              const vm = vms.find((v) => v.id === vmId);
              const cfg = serverConfigs[vmId];
              if (!vm || !cfg) return null;

              return (
                <div key={vmId} className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-sm text-slate-100">{vm.name}</span>
                        <span className="px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800/60 text-[10px] font-mono">
                          {cfg.tier}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Source: {vm.vcpu} vCPU &bull; {vm.memory_mb} MB &bull; {vm.total_disk_gb} GB ({vm.os_name})
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="text-slate-400 font-semibold text-[11px]">Auto-assign Public IP:</label>
                      <input
                        type="checkbox"
                        checked={cfg.assignPublicIp}
                        onChange={(e) => updateServerField(vmId, 'assignPublicIp', e.target.checked)}
                        className="rounded bg-slate-950 border-slate-800 text-indigo-600 focus:ring-0"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-2">
                    {/* Subnet Selection */}
                    <div>
                      <label className="block text-slate-400 mb-1 font-semibold">Target AWS Subnet</label>
                      <select
                        value={cfg.subnetId}
                        onChange={(e) => updateServerField(vmId, 'subnetId', e.target.value)}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
                      >
                        {subnets.length === 0 ? (
                          <option value="">No subnets available in VPC</option>
                        ) : (
                          subnets.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name || s.id} ({s.cidr_block} - {s.availability_zone})
                            </option>
                          ))
                        )}
                      </select>
                    </div>

                    {/* Instance Type */}
                    <div>
                      <label className="block text-slate-400 mb-1 font-semibold">EC2 Instance Sizing</label>
                      <select
                        value={cfg.instanceType}
                        onChange={(e) => updateServerField(vmId, 'instanceType', e.target.value)}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
                      >
                        <option value="t3.micro">t3.micro (2 vCPU, 1 GiB) - Free Tier</option>
                        <option value="t3.small">t3.small (2 vCPU, 2 GiB) - Lab Default</option>
                        <option value="t3.medium">t3.medium (2 vCPU, 4 GiB)</option>
                        <option value="c6i.large">c6i.large (2 vCPU, 4 GiB) - Compute</option>
                      </select>
                    </div>

                    {/* Security Group */}
                    <div>
                      <label className="block text-slate-400 mb-1 font-semibold">Security Group</label>
                      <select
                        value={cfg.securityGroupIds[0] || ''}
                        onChange={(e) => updateServerField(vmId, 'securityGroupIds', [e.target.value])}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
                      >
                        {securityGroups.length === 0 ? (
                          <option value="">No Security Groups found</option>
                        ) : (
                          securityGroups.map((sg) => (
                            <option key={sg.id} value={sg.id}>{sg.name || sg.id}</option>
                          ))
                        )}
                      </select>
                    </div>

                    {/* EBS Disk Size */}
                    <div>
                      <label className="block text-slate-400 mb-1 font-semibold">Target Disk (GB)</label>
                      <input
                        type="number"
                        value={cfg.diskSizeGb}
                        onChange={(e) => updateServerField(vmId, 'diskSizeGb', parseInt(e.target.value) || 50)}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: POST-MIGRATION IP RESOLUTION & VERIFICATION */}
      {activeTab === 'postmigration' && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-6">
          <div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Globe className="w-4 h-4 text-indigo-400" />
              <span>Handling IP Changes & Post-Migration Application Connectivity</span>
            </h3>
            <p className="text-slate-400 mt-1">
              Because moving to AWS will give your servers new IP addresses, select your preferred IP resolution strategy:
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-slate-950/70 border border-indigo-500/40 rounded-xl space-y-2">
              <span className="font-bold text-indigo-300 block">Option 1: Route 53 / Local DNS (Recommended)</span>
              <p className="text-slate-400 text-[11px]">
                Create a Private Hosted Zone (<code className="text-indigo-400">helpdesk.internal</code>) and point <code className="text-slate-200">db1.helpdesk.internal</code> and <code className="text-slate-200">app1.helpdesk.internal</code> to the new EC2 private IPs.
              </p>
              <div className="text-[10px] text-emerald-400 font-semibold">Zero hardcoded IP fragility</div>
            </div>

            <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-xl space-y-2">
              <span className="font-bold text-slate-200 block">Option 2: Private IP Preservation</span>
              <p className="text-slate-400 text-[11px]">
                If your target AWS VPC matches your on-prem subnet (<code className="text-slate-200">192.168.100.0/24</code>), assign exact original private IPs: <code className="text-slate-200">192.168.100.30</code> (DB) and <code className="text-slate-200">192.168.100.20</code> (App).
              </p>
              <div className="text-[10px] text-slate-400 font-semibold">Zero application config modifications</div>
            </div>

            <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-xl space-y-2">
              <span className="font-bold text-slate-200 block">Option 3: Automated /etc/hosts Injection</span>
              <p className="text-slate-400 text-[11px]">
                Our post-migration validation engine updates <code className="text-slate-200">/etc/hosts</code> on <code className="text-slate-200">web1</code> and <code className="text-slate-200">app1</code> via Cloud-Init to resolve each other's new AWS private IPs immediately upon first boot.
              </p>
              <div className="text-[10px] text-indigo-400 font-semibold">Automated in Migration Wizard</div>
            </div>
          </div>

          {/* Validation Checklist */}
          <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-3">
            <h4 className="font-bold text-slate-200 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Automated Post-Migration Health Probing Checklist</span>
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-slate-300">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>AWS EC2 System & Instance 2/2 status checks pass</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>PostgreSQL database port 5432 is listening and accepting sockets</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>App tier API responds on port 8080</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Web frontend returns HTTP 200 OK via reverse proxy</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: REVIEW & EXECUTE */}
      {activeTab === 'review' && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-100">Step-by-Step Migration Execution Plan</h3>
              <p className="text-slate-400">Recommended sequential wave execution order to prevent split-brain downtime:</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-xs">1</span>
                <div>
                  <span className="font-bold text-slate-200 block">Phase 1: Cold Export & Launch Database (db1)</span>
                  <span className="text-slate-400 text-[11px]">Export consistent disk &bull; Launch into Isolated DB Subnet &bull; Verify DB engine starts</span>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 font-mono text-[10px]">Zero Downtime for Read Replicas</span>
            </div>

            <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-xs">2</span>
                <div>
                  <span className="font-bold text-slate-200 block">Phase 2: Launch Application Backend (app1)</span>
                  <span className="text-slate-400 text-[11px]">Launch into Private App Subnet &bull; Connect to db1 on port 5432 &bull; Verify REST API</span>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 font-mono text-[10px]">Dependency Verified</span>
            </div>

            <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-xs">3</span>
                <div>
                  <span className="font-bold text-slate-200 block">Phase 3: Launch Web Tier (web1) & Cutover Traffic</span>
                  <span className="text-slate-400 text-[11px]">Launch into Public Web Subnet &bull; Route user traffic to new AWS IP &bull; Smoke test</span>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded bg-amber-950 text-amber-300 font-mono text-[10px]">Cutover Complete</span>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800 flex justify-end">
            <button
              onClick={handleLaunchMigration}
              className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold shadow-lg shadow-indigo-600/30 transition text-sm"
            >
              <span>Execute Migration With Configured Plan</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
