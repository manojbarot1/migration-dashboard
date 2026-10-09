export interface SourceInfrastructure {
  id: string;
  name: string;
  environment: string;
  platform: string;
  host: string;
  port: number;
  username: string;
  auth_type: string;
  use_sudo: boolean;
  description?: string;
  status: "Connected" | "Failed" | "Not Tested";
  last_checked?: string;
  error_message?: string;
  hypervisor_info?: {
    hostname?: string;
    libvirt_version?: string;
    hypervisor_version?: string;
    cpu_model?: string;
    total_memory_gb?: number;
  };
  vm_count: number;
}

export interface TargetInfrastructure {
  id: string;
  name: string;
  account_alias?: string;
  access_key_id?: string;
  masked_access_key: string;
  has_secret_key: boolean;
  default_region: string;
  role_arn?: string;
  description?: string;
  status: "Connected" | "Failed" | "Not Tested";
  account_id?: string;
  caller_arn?: string;
  last_checked?: string;
  error_message?: string;
  cached_regions: string[];
  cached_vpcs: AWSVpc[];
  cached_subnets: AWSSubnet[];
  cached_security_groups: AWSSecurityGroup[];
}

export interface AWSVpc {
  id: string;
  name: string;
  cidr_block: string;
  is_default: boolean;
  state: string;
}

export interface AWSSubnet {
  id: string;
  name: string;
  vpc_id: string;
  cidr_block: string;
  availability_zone: string;
  available_ips: number;
  map_public_ip: boolean;
  state: string;
}

export interface AWSSecurityGroup {
  id: string;
  name: string;
  description?: string;
  vpc_id: string;
  inbound_rules_count: number;
}

export interface DiskInfo {
  device: string;
  bus: string;
  path: string;
  format: string;
  capacity_bytes: number;
  allocation_bytes: number;
  capacity_gb: number;
  allocation_gb: number;
  backing_file?: string;
}

export interface InterfaceInfo {
  mac: string;
  type: string;
  model: string;
  source_network?: string;
  ip_addresses: string[];
}

export interface AssessmentItem {
  check: string;
  status: "Pass" | "Warning" | "Blocked";
  message: string;
  recommendation?: string;
}

export interface DiscoveredVM {
  id: string;
  source_id: string;
  source_name?: string;
  name: string;
  uuid: string;
  state: string;
  vcpu: number;
  memory_kb: number;
  memory_mb: number;
  os_name: string;
  firmware_type: string;
  disk_bus: string;
  total_disk_bytes: number;
  total_disk_gb: number;
  allocated_disk_bytes: number;
  allocated_disk_gb: number;
  disks: DiskInfo[];
  interfaces: InterfaceInfo[];
  xml_desc?: string;
  compatibility_status: "Pass" | "Warning" | "Blocked";
  compatibility_reasons: AssessmentItem[];
  last_discovered_at?: string;
}

export interface MigrationLog {
  id: number;
  job_id: string;
  timestamp: string;
  level: "INFO" | "WARNING" | "ERROR" | "SUCCESS";
  phase: string;
  message: string;
  details?: Record<string, any>;
}

export interface MigrationJob {
  id: string;
  name: string;
  source_id: string;
  target_id: string;
  vm_id: string;
  vm_name: string;
  status: "Pending" | "Validating" | "Preparing source" | "Exporting disks" | "Uploading disks" | "Importing image" | "Launching EC2" | "Validating target" | "Completed" | "Completed with warnings" | "Failed" | "Cancelled";
  phase: string;
  progress_pct: number;
  target_region: string;
  target_vpc_id?: string;
  target_subnet_id?: string;
  target_security_group_ids: string[];
  target_instance_type: string;
  target_instance_name?: string;
  target_disk_type: string;
  target_disk_size_gb: number;
  assign_public_ip: boolean;
  created_ami_id?: string;
  created_instance_id?: string;
  created_resources: Record<string, any>;
  validation_results: Record<string, any>;
  start_time?: string;
  end_time?: string;
  error_message?: string;
  can_retry: boolean;
  logs: MigrationLog[];
}

export interface DashboardOverview {
  total_sources: number;
  total_targets: number;
  total_vms: number;
  vms_selected_for_migration: number;
  migrations_in_progress: number;
  migrations_completed: number;
  migrations_failed: number;
  recent_activities: any[];
  sources_summary: any[];
  vms_summary: any[];
}

export interface DependencyItem {
  source?: string;
  target?: string;
  protocol?: string;
  port?: number;
  reason?: string;
  criticality?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}

export interface DependencyNode {
  id: string;
  name: string;
  tier: string;
  ip: string;
  state: string;
  vcpu: number;
  memory_mb: number;
  total_disk_gb: number;
  compatibility_status: "Pass" | "Warning" | "Blocked";
  network: string;
  dependencies: DependencyItem[];
  dependents: DependencyItem[];
}

export interface DependencyEdge {
  from: string;
  to: string;
  label: string;
  criticality: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}

export interface MoveGroup {
  group_id: string;
  name: string;
  description: string;
  vm_names: string[];
  vm_ids: string[];
  server_count: number;
  total_vcpus: number;
  total_memory_mb: number;
  total_disk_gb: number;
  wave_recommendation: string;
  coupling_risk: string;
  recommended_sequence: string[];
}

export interface DependencyGraphResponse {
  nodes: DependencyNode[];
  edges: DependencyEdge[];
  move_groups: MoveGroup[];
}

export interface MissingDependency {
  selected_server: string;
  required_server?: string;
  dependent_server?: string;
  protocol?: string;
  reason?: string;
  criticality?: string;
}

export interface GroupingSuggestionResponse {
  selected_vm_count: number;
  is_complete_group: boolean;
  missing_dependencies: MissingDependency[];
  missing_dependents: MissingDependency[];
  recommended_vm_names: string[];
  recommended_vm_ids: string[];
  warnings: string[];
  suggested_move_groups: MoveGroup[];
}
