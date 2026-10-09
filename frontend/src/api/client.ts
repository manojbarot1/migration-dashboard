import {
  SourceInfrastructure,
  TargetInfrastructure,
  DiscoveredVM,
  MigrationJob,
  DashboardOverview
} from '../types';

const API_BASE = '/api';

export const api = {
  // Overview
  async getOverview(): Promise<DashboardOverview> {
    const res = await fetch(`${API_BASE}/overview`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  // Sources
  async listSources(): Promise<SourceInfrastructure[]> {
    const res = await fetch(`${API_BASE}/sources`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async createSource(data: Partial<SourceInfrastructure> & { private_key?: string; password?: string }): Promise<SourceInfrastructure> {
    const res = await fetch(`${API_BASE}/sources`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async updateSource(id: string, data: any): Promise<SourceInfrastructure> {
    const res = await fetch(`${API_BASE}/sources/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async deleteSource(id: string): Promise<void> {
    const res = await fetch(`${API_BASE}/sources/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(await res.text());
  },

  async testSource(id: string): Promise<any> {
    const res = await fetch(`${API_BASE}/sources/${id}/test`, { method: 'POST' });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async discoverVMs(id: string): Promise<any> {
    const res = await fetch(`${API_BASE}/sources/${id}/discover`, { method: 'POST' });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  // Targets (AWS)
  async listTargets(): Promise<TargetInfrastructure[]> {
    const res = await fetch(`${API_BASE}/targets`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async createTarget(data: any): Promise<TargetInfrastructure> {
    const res = await fetch(`${API_BASE}/targets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async updateTarget(id: string, data: any): Promise<TargetInfrastructure> {
    const res = await fetch(`${API_BASE}/targets/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async deleteTarget(id: string): Promise<void> {
    const res = await fetch(`${API_BASE}/targets/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(await res.text());
  },

  async testTarget(id: string): Promise<any> {
    const res = await fetch(`${API_BASE}/targets/${id}/test`, { method: 'POST' });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async getTargetRegions(id: string): Promise<string[]> {
    const res = await fetch(`${API_BASE}/targets/${id}/regions`);
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    return data.regions;
  },

  async getTargetVPCs(id: string, region?: string): Promise<any[]> {
    const url = region ? `${API_BASE}/targets/${id}/vpcs?region=${encodeURIComponent(region)}` : `${API_BASE}/targets/${id}/vpcs`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    return data.vpcs;
  },

  async getTargetSubnets(id: string, vpcId: string, region?: string): Promise<any[]> {
    const url = `${API_BASE}/targets/${id}/subnets?vpc_id=${encodeURIComponent(vpcId)}${region ? `&region=${encodeURIComponent(region)}` : ''}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    return data.subnets;
  },

  async getTargetSecurityGroups(id: string, vpcId: string, region?: string): Promise<any[]> {
    const url = `${API_BASE}/targets/${id}/security-groups?vpc_id=${encodeURIComponent(vpcId)}${region ? `&region=${encodeURIComponent(region)}` : ''}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    return data.security_groups;
  },

  // VMs
  async listVMs(params?: { source_id?: string; state?: string; os?: string; compatibility?: string }): Promise<DiscoveredVM[]> {
    const q = new URLSearchParams();
    if (params?.source_id) q.set('source_id', params.source_id);
    if (params?.state) q.set('state', params.state);
    if (params?.os) q.set('os', params.os);
    if (params?.compatibility) q.set('compatibility', params.compatibility);

    const res = await fetch(`${API_BASE}/vms?${q.toString()}`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async getVM(id: string): Promise<DiscoveredVM> {
    const res = await fetch(`${API_BASE}/vms/${id}`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async reassessVM(id: string): Promise<DiscoveredVM> {
    const res = await fetch(`${API_BASE}/vms/${id}/assess`, { method: 'POST' });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  // Migration
  async generatePlan(payload: any): Promise<any> {
    const res = await fetch(`${API_BASE}/migration/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async createMigrationJobs(payloads: any[]): Promise<MigrationJob[]> {
    const res = await fetch(`${API_BASE}/migration/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payloads),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async listMigrationJobs(): Promise<MigrationJob[]> {
    const res = await fetch(`${API_BASE}/migration/jobs`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async getMigrationJob(id: string): Promise<MigrationJob> {
    const res = await fetch(`${API_BASE}/migration/jobs/${id}`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async cancelMigrationJob(id: string): Promise<any> {
    const res = await fetch(`${API_BASE}/migration/jobs/${id}/cancel`, { method: 'POST' });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async retryMigrationJob(id: string): Promise<MigrationJob> {
    const res = await fetch(`${API_BASE}/migration/jobs/${id}/retry`, { method: 'POST' });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  // Dependency Discovery & Move Grouping
  async getDependencyGraph(): Promise<any> {
    const res = await fetch(`${API_BASE}/vms/graph/dependencies`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async getGroupingSuggestions(selectedVmIds: string[]): Promise<any> {
    const res = await fetch(`${API_BASE}/vms/grouping/suggestions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ selected_vm_ids: selectedVmIds }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
};
