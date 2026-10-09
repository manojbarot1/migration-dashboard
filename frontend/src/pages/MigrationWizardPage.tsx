import React, { useState, useEffect } from 'react';
import {
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Play,
  Clock,
  Cloud,
  Server,
  HardDrive,
  ShieldAlert,
  Terminal,
  RefreshCw,
  ExternalLink,
  Layers,
  StopCircle
} from 'lucide-react';
import {
  DiscoveredVM,
  TargetInfrastructure,
  SourceInfrastructure,
  AWSVpc,
  AWSSubnet,
  AWSSecurityGroup,
  MigrationJob,
  GroupingSuggestionResponse,
  MoveGroup
} from '../types';
import { api } from '../api/client';
import { StatusBadge } from '../components/StatusBadge';
import { LogsViewer } from '../components/LogsViewer';

interface Props {
  vms: DiscoveredVM[];
  sources: SourceInfrastructure[];
  targets: TargetInfrastructure[];
  preselectedVmIds: string[];
  onRefresh: () => void;
  onNavigateToHistory: () => void;
}

export const MigrationWizardPage: React.FC<Props> = ({
  vms,
  sources,
  targets,
  preselectedVmIds,
  onRefresh,
  onNavigateToHistory
}) => {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [selectedVmIds, setSelectedVmIds] = useState<string[]>(preselectedVmIds || []);
  
  // Dependency Suggestions State
  const [dependencySuggestions, setDependencySuggestions] = useState<GroupingSuggestionResponse | null>(null);
  const [moveGroups, setMoveGroups] = useState<MoveGroup[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState<boolean>(false);

  // Fetch initial graph move groups & suggestions on VM selection change
  useEffect(() => {
    const fetchGraph = async () => {
      try {
        const graph = await api.getDependencyGraph();
        if (graph?.move_groups) {
          setMoveGroups(graph.move_groups);
        }
      } catch (err) {
        console.error('Failed to fetch dependency graph:', err);
      }
    };
    fetchGraph();
  }, []);

  useEffect(() => {
    if (selectedVmIds.length === 0) {
      setDependencySuggestions(null);
      return;
    }
    const fetchSuggestions = async () => {
      setLoadingSuggestions(true);
      try {
        const res = await api.getGroupingSuggestions(selectedVmIds);
        setDependencySuggestions(res);
      } catch (err) {
        console.error('Failed to fetch grouping suggestions:', err);
      } finally {
        setLoadingSuggestions(false);
      }
    };
    fetchSuggestions();
  }, [selectedVmIds]);

  // Step 2 Destination Form State
  const [targetId, setTargetId] = useState<string>(targets[0]?.id || '');
  const [targetRegion, setTargetRegion] = useState<string>(targets[0]?.default_region || 'us-east-1');
  const [vpcs, setVpcs] = useState<AWSVpc[]>([]);
  const [selectedVpcId, setSelectedVpcId] = useState<string>('');
  const [subnets, setSubnets] = useState<AWSSubnet[]>([]);
  const [selectedSubnetId, setSelectedSubnetId] = useState<string>('');
  const [securityGroups, setSecurityGroups] = useState<AWSSecurityGroup[]>([]);
  const [selectedSgIds, setSelectedSgIds] = useState<string[]>([]);
  const [instanceType, setInstanceType] = useState<string>('t3.small');
  const [instanceNamePrefix, setInstanceNamePrefix] = useState<string>('migrated');
  const [diskType, setDiskType] = useState<string>('gp3');
  const [diskSizeGb, setDiskSizeGb] = useState<number>(50);
  const [assignPublicIp, setAssignPublicIp] = useState<boolean>(false);
  const [iamRole, setIamRole] = useState<string>('');
  const [s3Bucket, setS3Bucket] = useState<string>('');

  // Step 3 Plan State
  const [plan, setPlan] = useState<any | null>(null);
  const [planLoading, setPlanLoading] = useState<boolean>(false);
  const [planConfirmed, setPlanConfirmed] = useState<boolean>(false);

  // Step 4 Execution State
  const [executing, setExecuting] = useState<boolean>(false);
  const [activeJobs, setActiveJobs] = useState<MigrationJob[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  // Load VPCs when targetId or targetRegion changes
  useEffect(() => {
    if (!targetId) return;
    const loadVpcs = async () => {
      try {
        // Reset selections while loading new region
        setVpcs([]);
        setSelectedVpcId('');
        setSubnets([]);
        setSelectedSubnetId('');
        setSecurityGroups([]);
        setSelectedSgIds([]);

        const vpcList = await api.getTargetVPCs(targetId, targetRegion);
        setVpcs(vpcList);
        if (vpcList.length > 0) {
          const vpcId = vpcList[0].id;
          setSelectedVpcId(vpcId);
          const [subList, sgList] = await Promise.all([
            api.getTargetSubnets(targetId, vpcId, targetRegion),
            api.getTargetSecurityGroups(targetId, vpcId, targetRegion),
          ]);
          setSubnets(subList);
          if (subList.length > 0) setSelectedSubnetId(subList[0].id);
          setSecurityGroups(sgList);
          if (sgList.length > 0) setSelectedSgIds([sgList[0].id]);
        }
      } catch (err) {
        console.error('Error loading VPCs:', err);
      }
    };
    loadVpcs();
  }, [targetId, targetRegion]);

  // Load subnets when VPC changes
  const handleVpcChange = async (vpcId: string) => {
    setSelectedVpcId(vpcId);
    try {
      const [subList, sgList] = await Promise.all([
        api.getTargetSubnets(targetId, vpcId, targetRegion),
        api.getTargetSecurityGroups(targetId, vpcId, targetRegion),
      ]);
      setSubnets(subList);
      if (subList.length > 0) setSelectedSubnetId(subList[0].id);
      setSecurityGroups(sgList);
      if (sgList.length > 0) setSelectedSgIds([sgList[0].id]);
    } catch (err) {
      console.error('Error loading subnets/sgs:', err);
    }
  };

  // Poll active jobs during execution
  useEffect(() => {
    let timer: any = null;
    if (currentStep === 4 && activeJobs.length > 0) {
      timer = setInterval(async () => {
        try {
          const updatedJobs = await Promise.all(
            activeJobs.map((j) => api.getMigrationJob(j.id))
          );
          setActiveJobs(updatedJobs);
          // Check if all finished
          const allDone = updatedJobs.every(
            (j) => ['Completed', 'Completed with warnings', 'Failed', 'Cancelled'].includes(j.status)
          );
          if (allDone) {
            setExecuting(false);
          }
        } catch (err) {
          console.error('Polling error:', err);
        }
      }, 2000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [currentStep, activeJobs]);

  // Generate Migration Plan on entering Step 3
  const handleGoToStep3 = async () => {
    if (selectedVmIds.length === 0) {
      alert('Please select at least one source VM.');
      return;
    }
    if (!targetId) {
      alert('Please select an AWS target infrastructure.');
      return;
    }
    if (!selectedVpcId || !selectedSubnetId) {
      alert(`The selected region (${targetRegion}) does not have an active VPC or Subnet configured for this AWS account. Please select a region with an existing VPC (e.g. eu-central-1, us-east-1, us-east-2) or ensure a VPC and subnet are created.`);
      return;
    }

    setPlanLoading(true);
    setCurrentStep(3);
    try {
      const firstVm = vms.find((v) => v.id === selectedVmIds[0]);
      const planRes = await api.generatePlan({
        source_id: firstVm?.source_id || sources[0]?.id,
        target_id: targetId,
        vm_ids: selectedVmIds,
        target_region: targetRegion,
        target_vpc_id: selectedVpcId || 'vpc-default',
        target_subnet_id: selectedSubnetId || 'subnet-default',
        target_security_group_ids: selectedSgIds,
        target_instance_type: instanceType,
        target_disk_type: diskType,
        assign_public_ip: assignPublicIp,
        iam_instance_profile: iamRole || undefined,
        s3_bucket: s3Bucket || undefined,
      });
      setPlan(planRes);
    } catch (err: any) {
      alert(`Plan generation failed: ${err.message}`);
      setCurrentStep(2);
    } finally {
      setPlanLoading(false);
    }
  };

  // Launch Migration Execution
  const handleExecuteMigration = async () => {
    if (!planConfirmed) {
      alert('Please confirm the migration plan before proceeding.');
      return;
    }

    setExecuting(true);
    setCurrentStep(4);

    try {
      const payloads = selectedVmIds.map((vmId) => {
        const vm = vms.find((v) => v.id === vmId);
        return {
          source_id: vm?.source_id || sources[0]?.id,
          target_id: targetId,
          vm_id: vmId,
          target_region: targetRegion,
          target_vpc_id: selectedVpcId,
          target_subnet_id: selectedSubnetId,
          target_security_group_ids: selectedSgIds,
          target_instance_type: instanceType,
          target_instance_name: `${instanceNamePrefix}-${vm?.name}`,
          target_disk_type: diskType,
          target_disk_size_gb: diskSizeGb,
          assign_public_ip: assignPublicIp,
          iam_instance_profile: iamRole || undefined,
          s3_bucket: s3Bucket || undefined,
        };
      });

      const jobs = await api.createMigrationJobs(payloads);
      setActiveJobs(jobs);
      if (jobs.length > 0) setSelectedJobId(jobs[0].id);
      onRefresh();
    } catch (err: any) {
      alert(`Failed to start migration: ${err.message}`);
      setExecuting(false);
    }
  };

  const handleCancelJob = async (jobId: string) => {
    if (!confirm('Are you sure you want to cancel this migration job?')) return;
    try {
      await api.cancelMigrationJob(jobId);
      const updated = await api.getMigrationJob(jobId);
      setActiveJobs(activeJobs.map((j) => (j.id === jobId ? updated : j)));
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleRetryJob = async (jobId: string) => {
    try {
      const updated = await api.retryMigrationJob(jobId);
      setActiveJobs(activeJobs.map((j) => (j.id === jobId ? updated : j)));
      setExecuting(true);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const currentJob = activeJobs.find((j) => j.id === selectedJobId) || activeJobs[0];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Wizard Header & Stepper */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div>
            <h2 className="text-xl font-bold text-slate-100 tracking-tight">VM Migration Wizard</h2>
            <p className="text-xs text-slate-400">Step-by-step cold migration from QEMU/KVM to Amazon EC2</p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            {['1. Select VMs', '2. AWS Destination', '3. Plan Review', '4. Execution'].map((name, i) => {
              const stepNum = i + 1;
              const isPast = currentStep > stepNum;
              const isCurr = currentStep === stepNum;
              return (
                <div key={i} className="flex items-center gap-2">
                  <div
                    className={`flex items-center justify-center w-6 h-6 rounded-full font-bold text-xs transition ${
                      isPast
                        ? 'bg-emerald-500 text-white'
                        : isCurr
                        ? 'bg-indigo-600 text-white ring-4 ring-indigo-600/20'
                        : 'bg-slate-800 text-slate-500'
                    }`}
                  >
                    {isPast ? <CheckCircle2 className="w-4 h-4" /> : stepNum}
                  </div>
                  <span className={`font-semibold hidden md:inline ${isCurr ? 'text-slate-100' : 'text-slate-500'}`}>
                    {name}
                  </span>
                  {i < 3 && <span className="text-slate-700 hidden md:inline">&rarr;</span>}
                </div>
              );
            })}
          </div>
        </div>

        {/* STEP 1: Select Source VMs */}
        {currentStep === 1 && (
          <div className="pt-6 space-y-6 text-xs">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-100">Step 1: Choose Source Virtual Machines</h3>
                <p className="text-slate-400">Select virtual machines to migrate. The Dependency Engine will advise if coupled servers should be migrated together.</p>
              </div>
              <span className="text-indigo-400 font-semibold">{selectedVmIds.length} VM(s) selected</span>
            </div>

            {/* Quick Move Group Selection Waves */}
            {moveGroups.length > 0 && (
              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-indigo-400" />
                    <span className="font-semibold text-slate-200">Recommended Migration Waves / Move Groups</span>
                  </div>
                  <span className="text-[11px] text-slate-500">One-click select coupled application stacks</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {moveGroups.map((group) => {
                    const allSelected = group.vm_ids.every((id) => selectedVmIds.includes(id));
                    const someSelected = group.vm_ids.some((id) => selectedVmIds.includes(id));
                    return (
                      <div
                        key={group.group_id}
                        className={`p-3 rounded-lg border transition ${
                          allSelected
                            ? 'bg-indigo-950/40 border-indigo-500/80 shadow-sm shadow-indigo-500/10'
                            : someSelected
                            ? 'bg-amber-950/20 border-amber-600/50'
                            : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="font-bold text-slate-200 flex items-center gap-2">
                              <span>{group.name}</span>
                              <span className="px-1.5 py-0.5 text-[10px] rounded bg-slate-800 text-slate-300 font-mono">
                                {group.server_count} VM{group.server_count > 1 ? 's' : ''}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">{group.description}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              if (allSelected) {
                                setSelectedVmIds(selectedVmIds.filter((id) => !group.vm_ids.includes(id)));
                              } else {
                                const newIds = Array.from(new Set([...selectedVmIds, ...group.vm_ids]));
                                setSelectedVmIds(newIds);
                              }
                            }}
                            className={`px-2.5 py-1 rounded text-[11px] font-semibold whitespace-nowrap transition ${
                              allSelected
                                ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                                : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                            }`}
                          >
                            {allSelected ? 'Selected (Deselect)' : 'Select Wave'}
                          </button>
                        </div>
                        <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex flex-wrap gap-2 text-[10px]">
                          <span className="text-slate-400">Servers: <span className="text-slate-200 font-mono">{group.vm_names.join(', ')}</span></span>
                          <span className="text-slate-600">•</span>
                          <span className="text-slate-400">Seq: <span className="text-indigo-300">{group.recommended_sequence.join(' → ')}</span></span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Dependency Advisory Banner */}
            {dependencySuggestions && !dependencySuggestions.is_complete_group && (
              <div className="bg-amber-950/30 border border-amber-500/40 rounded-xl p-4 animate-fade-in">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-bold text-amber-200">
                        Dependency Advisory: Incomplete Application Stack Selected
                      </h4>
                      <p className="text-[11px] text-amber-300/90 mt-1">
                        The selected server(s) have critical dependencies on other servers. Migrating them separately creates cross-cloud network latency and communication failure.
                      </p>
                      <ul className="mt-2 space-y-1 text-[11px] text-amber-200/80 list-disc list-inside">
                        {dependencySuggestions.warnings.map((warn, idx) => (
                          <li key={idx}>{warn}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  {dependencySuggestions.recommended_vm_ids.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const merged = Array.from(new Set([...selectedVmIds, ...dependencySuggestions.recommended_vm_ids]));
                        setSelectedVmIds(merged);
                      }}
                      className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs whitespace-nowrap shadow transition shrink-0"
                    >
                      + Add Dependent Servers ({dependencySuggestions.recommended_vm_names.join(', ')})
                    </button>
                  )}
                </div>
              </div>
            )}

            {dependencySuggestions && dependencySuggestions.is_complete_group && selectedVmIds.length > 0 && (
              <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-xl p-3 flex items-center justify-between text-xs text-emerald-300">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span><strong>Move Group Complete:</strong> All upstream & downstream dependencies for the selected workload are included.</span>
                </div>
                <span className="text-[11px] text-emerald-400 font-mono">Zero cross-cloud dependency risk</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {vms.length === 0 ? (
                <div className="col-span-3 p-8 bg-slate-950/40 rounded-xl text-center text-slate-500">
                  No VMs discovered yet. Run discovery on the Source Infrastructure page first.
                </div>
              ) : (
                vms.map((vm) => {
                  const isSelected = selectedVmIds.includes(vm.id);
                  return (
                    <div
                      key={vm.id}
                      onClick={() => {
                        if (isSelected) {
                          setSelectedVmIds(selectedVmIds.filter((id) => id !== vm.id));
                        } else {
                          setSelectedVmIds([...selectedVmIds, vm.id]);
                        }
                      }}
                      className={`p-4 rounded-xl border cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-indigo-950/40 border-indigo-500 shadow-md shadow-indigo-500/10'
                          : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="font-bold text-sm text-slate-100">{vm.name}</div>
                        <StatusBadge status={vm.compatibility_status} />
                      </div>

                      <div className="space-y-1.5 text-slate-400 text-xs">
                        <div className="flex justify-between">
                          <span>Power State:</span>
                          <StatusBadge status={vm.state} />
                        </div>
                        <div className="flex justify-between">
                          <span>Guest OS:</span>
                          <span className="text-slate-300 font-medium">{vm.os_name}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Compute:</span>
                          <span className="text-slate-300">{vm.vcpu} vCPU / {vm.memory_mb} MB</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Storage:</span>
                          <span className="text-slate-200 font-semibold">{vm.total_disk_gb} GB ({vm.disks[0]?.format.toUpperCase() || 'QCOW2'})</span>
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                        <span className="text-slate-500 font-mono truncate">{vm.source_name || 'Ubuntu Host'}</span>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="rounded bg-slate-950 border-slate-700 text-indigo-600 focus:ring-0"
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-800">
              <button
                disabled={selectedVmIds.length === 0}
                onClick={() => setCurrentStep(2)}
                className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-xl font-semibold shadow-md transition"
              >
                <span>Continue to Target Selection</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: Select AWS Destination */}
        {currentStep === 2 && (
          <div className="pt-6 space-y-6 text-xs">
            <div>
              <h3 className="text-sm font-bold text-slate-100">Step 2: Configure AWS Target Environment</h3>
              <p className="text-slate-400">Select target AWS VPC, subnet, security group, and EC2 instance type.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Target Infra & Region */}
              <div className="space-y-3 p-4 bg-slate-950/60 border border-slate-800 rounded-xl">
                <h4 className="font-semibold text-slate-200 uppercase tracking-wider text-[11px]">Cloud Target & Region</h4>
                <div>
                  <label className="block text-slate-400 mb-1">Target AWS Connection</label>
                  <select
                    value={targetId}
                    onChange={(e) => setTargetId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-200"
                  >
                    {targets.map((t) => (
                      <option key={t.id} value={t.id}>{t.name} ({t.account_alias || 'AWS'})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Destination Region</label>
                  <select
                    value={targetRegion}
                    onChange={(e) => setTargetRegion(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-200"
                  >
                    <option value="us-east-1">us-east-1 (N. Virginia)</option>
                    <option value="us-east-2">us-east-2 (Ohio)</option>
                    <option value="us-west-1">us-west-1 (N. California)</option>
                    <option value="us-west-2">us-west-2 (Oregon)</option>
                    <option value="eu-west-1">eu-west-1 (Ireland)</option>
                    <option value="eu-north-1">eu-north-1 (Stockholm)</option>
                    <option value="eu-central-1">eu-central-1 (Frankfurt)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Staging S3 Bucket (Optional)</label>
                  <input
                    type="text"
                    value={s3Bucket}
                    onChange={(e) => setS3Bucket(e.target.value)}
                    placeholder="vm-migration-export-bucket (auto-created if empty)"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 font-mono text-[11px]"
                  />
                </div>
              </div>

              {/* Networking */}
              <div className="space-y-3 p-4 bg-slate-950/60 border border-slate-800 rounded-xl">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-slate-200 uppercase tracking-wider text-[11px]">Destination VPC & Subnet</h4>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!targetId) return;
                      try {
                        const vpcList = await api.getTargetVPCs(targetId, targetRegion);
                        setVpcs(vpcList);
                        if (vpcList.length > 0) {
                          const vpcId = vpcList[0].id;
                          setSelectedVpcId(vpcId);
                          const [subList, sgList] = await Promise.all([
                            api.getTargetSubnets(targetId, vpcId, targetRegion),
                            api.getTargetSecurityGroups(targetId, vpcId, targetRegion),
                          ]);
                          setSubnets(subList);
                          if (subList.length > 0) setSelectedSubnetId(subList[0].id);
                          setSecurityGroups(sgList);
                          if (sgList.length > 0) setSelectedSgIds([sgList[0].id]);
                        }
                      } catch (err) {
                        console.error('Failed to refresh networking:', err);
                      }
                    }}
                    className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-medium border border-slate-700 transition"
                  >
                    <RefreshCw className="w-3 h-3 text-indigo-400" />
                    <span>Refresh</span>
                  </button>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Target VPC</label>
                  <select
                    value={selectedVpcId}
                    onChange={(e) => handleVpcChange(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-200"
                  >
                    {vpcs.length === 0 ? (
                      <option value="">No VPCs found (verify credentials)</option>
                    ) : (
                      vpcs.map((v) => (
                        <option key={v.id} value={v.id}>{v.name || v.id} ({v.cidr_block})</option>
                      ))
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Target Subnet</label>
                  <select
                    value={selectedSubnetId}
                    onChange={(e) => setSelectedSubnetId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-200"
                  >
                    {subnets.length === 0 ? (
                      <option value="">No subnets in VPC</option>
                    ) : (
                      subnets.map((s) => (
                        <option key={s.id} value={s.id}>{s.name || s.id} ({s.cidr_block} - {s.availability_zone})</option>
                      ))
                    )}
                  </select>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="public_ip"
                    checked={assignPublicIp}
                    onChange={(e) => setAssignPublicIp(e.target.checked)}
                    className="rounded bg-slate-950 border-slate-800 text-indigo-600 focus:ring-0"
                  />
                  <label htmlFor="public_ip" className="text-slate-300 cursor-pointer">
                    Auto-assign Public IPv4 address
                  </label>
                </div>
              </div>

              {/* Compute & Sizing */}
              <div className="space-y-3 p-4 bg-slate-950/60 border border-slate-800 rounded-xl">
                <h4 className="font-semibold text-slate-200 uppercase tracking-wider text-[11px]">EC2 Compute & Instance Type</h4>
                <div>
                  <label className="block text-slate-400 mb-1">Instance Type</label>
                  <select
                    value={instanceType}
                    onChange={(e) => setInstanceType(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-200"
                  >
                    <option value="t3.micro">t3.micro (2 vCPU, 1 GiB) - Free Tier Eligible</option>
                    <option value="t3.small">t3.small (2 vCPU, 2 GiB) - Recommended for Lab</option>
                    <option value="t3.medium">t3.medium (2 vCPU, 4 GiB)</option>
                    <option value="t3.large">t3.large (2 vCPU, 8 GiB)</option>
                    <option value="c6i.large">c6i.large (2 vCPU, 4 GiB) - Compute Optimized</option>
                    <option value="m6i.large">m6i.large (2 vCPU, 8 GiB) - General Purpose</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Target Instance Name Tag</label>
                  <input
                    type="text"
                    value={instanceNamePrefix}
                    onChange={(e) => setInstanceNamePrefix(e.target.value)}
                    placeholder="migrated"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 font-mono text-[11px]"
                  />
                </div>
              </div>

              {/* Storage */}
              <div className="space-y-3 p-4 bg-slate-950/60 border border-slate-800 rounded-xl">
                <h4 className="font-semibold text-slate-200 uppercase tracking-wider text-[11px]">EBS Storage Settings</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1">EBS Volume Type</label>
                    <select
                      value={diskType}
                      onChange={(e) => setDiskType(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-200"
                    >
                      <option value="gp3">General Purpose SSD (gp3)</option>
                      <option value="gp2">General Purpose SSD (gp2)</option>
                      <option value="io2">Provisioned IOPS SSD (io2)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Size (GB)</label>
                    <input
                      type="number"
                      value={diskSizeGb}
                      onChange={(e) => setDiskSizeGb(parseInt(e.target.value) || 50)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-200"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">IAM Instance Profile (Optional)</label>
                  <input
                    type="text"
                    value={iamRole}
                    onChange={(e) => setIamRole(e.target.value)}
                    placeholder="e.g. AmazonSSMManagedInstanceCore"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 font-mono text-[11px]"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-between pt-4 border-t border-slate-800">
              <button
                onClick={() => setCurrentStep(1)}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-semibold transition"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>

              <button
                onClick={handleGoToStep3}
                className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold shadow-md transition"
              >
                <span>Generate Migration Plan</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Migration Plan */}
        {currentStep === 3 && (
          <div className="pt-6 space-y-6 text-xs">
            <div>
              <h3 className="text-sm font-bold text-slate-100">Step 3: Review Proposed Migration Plan</h3>
              <p className="text-slate-400">
                Verify target AWS resource mapping, estimated transfer, downtime notice, and cloud cost implications.
              </p>
            </div>

            {planLoading ? (
              <div className="p-12 text-center text-slate-400 space-y-2">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto text-indigo-500" />
                <p>Generating and validating migration plan against AWS prerequisites...</p>
              </div>
            ) : plan ? (
              <div className="space-y-5">
                {/* VM Mapping Summary Table */}
                <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/40">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900/80 text-slate-400 font-semibold border-b border-slate-800">
                      <tr>
                        <th className="py-2.5 px-4">Source VM</th>
                        <th className="py-2.5 px-4">Source Specs</th>
                        <th className="py-2.5 px-4">Target Instance Type</th>
                        <th className="py-2.5 px-4">Storage (EBS)</th>
                        <th className="py-2.5 px-4">Assessment Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {plan.vms?.map((v: any) => (
                        <tr key={v.vm_id}>
                          <td className="py-2.5 px-4 font-semibold text-slate-100">{v.vm_name}</td>
                          <td className="py-2.5 px-4 text-slate-400">
                            {v.source_vcpus} vCPU &bull; {v.source_memory_mb} MB &bull; {v.source_disk_gb} GB
                          </td>
                          <td className="py-2.5 px-4 font-mono text-indigo-400 font-semibold">{v.target_instance_type}</td>
                          <td className="py-2.5 px-4 text-slate-300 font-medium">{v.target_disk_type.toUpperCase()} ({v.target_disk_size_gb} GB)</td>
                          <td className="py-2.5 px-4"><StatusBadge status={v.compatibility_status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Cloud Destination & Transfer Summary */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2">
                    <h4 className="font-semibold text-slate-200 uppercase tracking-wider text-[11px]">AWS Target Location</h4>
                    <p><strong>Region:</strong> <span className="font-mono text-indigo-400">{plan.target_region}</span></p>
                    <p><strong>Destination VPC:</strong> <span className="font-mono text-slate-300">{plan.target_vpc_name}</span></p>
                    <p><strong>Destination Subnet:</strong> <span className="font-mono text-slate-300">{plan.target_subnet_cidr}</span></p>
                    <p><strong>Estimated Image Transfer:</strong> <span className="font-semibold text-slate-100">{plan.estimated_data_transfer_gb} GB</span></p>
                  </div>

                  <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2">
                    <h4 className="font-semibold text-slate-200 uppercase tracking-wider text-[11px]">AWS Cost Advisory</h4>
                    <ul className="space-y-1 text-slate-400 list-disc list-inside">
                      {plan.cost_warnings?.map((cw: string, i: number) => (
                        <li key={i}>{cw}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Workflow Actions & Downtime Notice */}
                <div className="p-4 bg-indigo-950/20 border border-indigo-500/30 rounded-xl space-y-2 text-indigo-200">
                  <h4 className="font-semibold uppercase tracking-wider text-[11px] text-indigo-300">Downtime & Preservation Policy</h4>
                  <p className="text-xs">{plan.downtime_notice}</p>
                  <p className="text-[11px] text-indigo-300/80">
                    The source VM will be safely left in its existing state. Original disks on the Ubuntu host will not be modified or deleted.
                  </p>
                </div>

                {/* Explicit Confirmation Checkbox */}
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="plan_confirm"
                    checked={planConfirmed}
                    onChange={(e) => setPlanConfirmed(e.target.checked)}
                    className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-0"
                  />
                  <label htmlFor="plan_confirm" className="text-slate-200 font-semibold cursor-pointer">
                    I explicitly confirm and authorize the execution of this migration plan into AWS EC2.
                  </label>
                </div>
              </div>
            ) : null}

            <div className="flex justify-between pt-4 border-t border-slate-800">
              <button
                onClick={() => setCurrentStep(2)}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-semibold transition"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>

              <button
                disabled={!planConfirmed || !plan?.is_valid}
                onClick={handleExecuteMigration}
                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-xl font-semibold shadow-lg shadow-emerald-600/20 transition"
              >
                <Play className="w-4 h-4" />
                <span>Execute Migration Workflow</span>
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: Live Execution Dashboard */}
        {currentStep === 4 && (
          <div className="pt-6 space-y-6 text-xs">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-100">Step 4: Migration Execution in Progress</h3>
                <p className="text-slate-400">
                  Tracking cold export, disk staging, AWS image import, and EC2 instance launch.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={onNavigateToHistory}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open History</span>
                </button>
              </div>
            </div>

            {/* Active Jobs Tabs if multiple */}
            {activeJobs.length > 1 && (
              <div className="flex gap-2 border-b border-slate-800 pb-2">
                {activeJobs.map((j) => (
                  <button
                    key={j.id}
                    onClick={() => setSelectedJobId(j.id)}
                    className={`px-3 py-1.5 rounded-lg font-medium flex items-center gap-2 ${
                      currentJob?.id === j.id
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span>{j.vm_name}</span>
                    <StatusBadge status={j.status} />
                  </button>
                ))}
              </div>
            )}

            {currentJob && (
              <div className="space-y-6">
                {/* Status & Progress Bar */}
                <div className="p-6 bg-slate-950/60 border border-slate-800 rounded-2xl space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Current Operation</span>
                      <h4 className="text-lg font-bold text-slate-100 flex items-center gap-2 mt-0.5">
                        <span>{currentJob.phase}</span>
                      </h4>
                    </div>

                    <div className="flex items-center gap-3">
                      <StatusBadge status={currentJob.status} />
                      <span className="text-2xl font-bold font-mono text-indigo-400">{currentJob.progress_pct}%</span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        currentJob.status === 'Completed'
                          ? 'bg-emerald-500'
                          : currentJob.status === 'Failed'
                          ? 'bg-rose-500'
                          : 'bg-indigo-500'
                      }`}
                      style={{ width: `${currentJob.progress_pct}%` }}
                    />
                  </div>

                  {/* Action Controls: Cancel / Retry */}
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-slate-500 text-[11px]">
                      Job ID: <span className="font-mono text-slate-400">{currentJob.id}</span>
                    </span>

                    <div className="flex items-center gap-2">
                      {['Pending', 'Validating', 'Preparing source', 'Exporting disks', 'Uploading disks', 'Importing image', 'Launching EC2', 'Validating target'].includes(currentJob.status) && (
                        <button
                          onClick={() => handleCancelJob(currentJob.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-500/30 rounded-lg font-medium transition"
                        >
                          <StopCircle className="w-3.5 h-3.5" />
                          <span>Cancel Job</span>
                        </button>
                      )}

                      {['Failed', 'Cancelled'].includes(currentJob.status) && currentJob.can_retry && (
                        <button
                          onClick={() => handleRetryJob(currentJob.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium shadow transition"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Retry Safe Execution</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Resulting AWS Resources Card (if provisioned) */}
                {currentJob.created_instance_id && (
                  <div className="p-5 bg-emerald-950/20 border border-emerald-500/30 rounded-2xl space-y-3">
                    <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                      <CheckCircle2 className="w-5 h-5" />
                      <span>AWS Cloud Resources Provisioned Successfully</span>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs pt-1">
                      <div>
                        <span className="text-slate-400 text-[10px] uppercase font-semibold block">EC2 Instance ID</span>
                        <span className="font-mono font-bold text-emerald-300">{currentJob.created_instance_id}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[10px] uppercase font-semibold block">Machine Image (AMI)</span>
                        <span className="font-mono text-slate-200">{currentJob.created_ami_id || 'ami-imported'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[10px] uppercase font-semibold block">Target Region</span>
                        <span className="font-mono text-slate-200">{currentJob.target_region}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[10px] uppercase font-semibold block">Instance Type</span>
                        <span className="font-mono text-slate-200">{currentJob.target_instance_type}</span>
                      </div>
                    </div>

                    {currentJob.validation_results?.validation_summary && (
                      <p className="text-[11px] text-slate-300 pt-2 border-t border-emerald-500/20">
                        <strong>Validation Report:</strong> {currentJob.validation_results.validation_summary}
                      </p>
                    )}
                  </div>
                )}

                {/* Live Console Logs Viewer */}
                <LogsViewer logs={currentJob.logs || []} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
