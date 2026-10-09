from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, ConfigDict

# --- Source Infrastructure ---
class SourceInfraBase(BaseModel):
    name: str
    environment: str = "Lab"
    platform: str = "QEMU/KVM"
    host: str
    port: int = 22
    username: str
    auth_type: str = "key"  # key or password
    use_sudo: bool = False
    description: Optional[str] = None

class SourceInfraCreate(SourceInfraBase):
    private_key: Optional[str] = None
    password: Optional[str] = None

class SourceInfraUpdate(BaseModel):
    name: Optional[str] = None
    environment: Optional[str] = None
    host: Optional[str] = None
    port: Optional[int] = None
    username: Optional[str] = None
    auth_type: Optional[str] = None
    private_key: Optional[str] = None
    password: Optional[str] = None
    use_sudo: Optional[bool] = None
    description: Optional[str] = None

class SourceInfraResponse(SourceInfraBase):
    id: str
    status: str
    last_checked: Optional[datetime] = None
    error_message: Optional[str] = None
    hypervisor_info: Optional[Dict[str, Any]] = None
    vm_count: int = 0

    model_config = ConfigDict(from_attributes=True)

class TestSourceResponse(BaseModel):
    success: bool
    ssh_connected: bool
    virsh_available: bool
    libvirt_accessible: bool
    hypervisor_hostname: Optional[str] = None
    libvirt_version: Optional[str] = None
    hypervisor_version: Optional[str] = None
    cpu_model: Optional[str] = None
    total_memory_gb: Optional[float] = None
    message: str
    missing_prerequisites: List[Dict[str, str]] = []


# --- Target Infrastructure (AWS) ---
class TargetInfraBase(BaseModel):
    name: str
    account_alias: Optional[str] = None
    access_key_id: Optional[str] = None
    default_region: str = "us-east-1"
    role_arn: Optional[str] = None
    description: Optional[str] = None

class TargetInfraCreate(TargetInfraBase):
    secret_access_key: Optional[str] = None
    session_token: Optional[str] = None

class TargetInfraUpdate(BaseModel):
    name: Optional[str] = None
    account_alias: Optional[str] = None
    access_key_id: Optional[str] = None
    secret_access_key: Optional[str] = None
    session_token: Optional[str] = None
    default_region: Optional[str] = None
    role_arn: Optional[str] = None
    description: Optional[str] = None

class TargetInfraResponse(TargetInfraBase):
    id: str
    masked_access_key: str
    has_secret_key: bool
    status: str
    account_id: Optional[str] = None
    caller_arn: Optional[str] = None
    last_checked: Optional[datetime] = None
    error_message: Optional[str] = None
    cached_regions: List[str] = []
    cached_vpcs: List[Dict[str, Any]] = []
    cached_subnets: List[Dict[str, Any]] = []
    cached_security_groups: List[Dict[str, Any]] = []

    model_config = ConfigDict(from_attributes=True)

class TestTargetResponse(BaseModel):
    success: bool
    account_id: Optional[str] = None
    arn: Optional[str] = None
    user_id: Optional[str] = None
    message: str
    error: Optional[str] = None


# --- Discovered VMs & Assessment ---
class DiskInfo(BaseModel):
    device: str
    bus: str
    path: str
    format: str
    capacity_bytes: int
    allocation_bytes: int
    capacity_gb: float
    allocation_gb: float
    backing_file: Optional[str] = None

class InterfaceInfo(BaseModel):
    mac: str
    type: str
    model: str
    source_network: Optional[str] = None
    ip_addresses: List[str] = []

class AssessmentItem(BaseModel):
    check: str
    status: str  # Pass, Warning, Blocked
    message: str
    recommendation: Optional[str] = None

class DiscoveredVMResponse(BaseModel):
    id: str
    source_id: str
    source_name: Optional[str] = None
    name: str
    uuid: str
    state: str
    vcpu: int
    memory_kb: int
    memory_mb: float
    os_name: str
    firmware_type: str
    disk_bus: str
    total_disk_bytes: int
    total_disk_gb: float
    allocated_disk_bytes: int
    allocated_disk_gb: float
    disks: List[DiskInfo] = []
    interfaces: List[InterfaceInfo] = []
    xml_desc: Optional[str] = None
    compatibility_status: str
    compatibility_reasons: List[AssessmentItem] = []
    last_discovered_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


# --- Migration Wizard & Planning ---
class MigrationPlanRequest(BaseModel):
    source_id: str
    target_id: str
    vm_ids: List[str]
    target_region: str
    target_vpc_id: str
    target_subnet_id: str
    target_security_group_ids: List[str]
    target_instance_type: str
    target_disk_type: str = "gp3"
    assign_public_ip: bool = False
    iam_instance_profile: Optional[str] = None
    s3_bucket: Optional[str] = None

class VMPlanSummary(BaseModel):
    vm_id: str
    vm_name: str
    source_vcpus: int
    source_memory_mb: float
    source_disk_gb: float
    target_instance_type: str
    target_disk_type: str
    target_disk_size_gb: int
    compatibility_status: str
    warnings: List[str] = []
    blockers: List[str] = []

class MigrationPlanResponse(BaseModel):
    is_valid: bool
    blockers: List[str] = []
    warnings: List[str] = []
    vms: List[VMPlanSummary] = []
    target_region: str
    target_vpc_name: Optional[str] = None
    target_subnet_cidr: Optional[str] = None
    estimated_data_transfer_gb: float
    cost_warnings: List[str] = []
    actions_summary: List[str] = []
    downtime_notice: str


class MigrationJobCreate(BaseModel):
    source_id: str
    target_id: str
    vm_id: str
    target_region: str
    target_vpc_id: str
    target_subnet_id: str
    target_security_group_ids: List[str]
    target_instance_type: str
    target_instance_name: Optional[str] = None
    target_disk_type: str = "gp3"
    target_disk_size_gb: Optional[int] = None
    assign_public_ip: bool = False
    iam_instance_profile: Optional[str] = None
    s3_bucket: Optional[str] = None

class MigrationLogResponse(BaseModel):
    id: int
    job_id: str
    timestamp: datetime
    level: str
    phase: str
    message: str
    details: Optional[Dict[str, Any]] = None

    model_config = ConfigDict(from_attributes=True)

class MigrationJobResponse(BaseModel):
    id: str
    name: str
    source_id: str
    target_id: str
    vm_id: str
    vm_name: str
    status: str
    phase: str
    progress_pct: int
    target_region: str
    target_vpc_id: Optional[str] = None
    target_subnet_id: Optional[str] = None
    target_security_group_ids: List[str] = []
    target_instance_type: str
    target_instance_name: Optional[str] = None
    target_disk_type: str
    target_disk_size_gb: int
    assign_public_ip: bool
    created_ami_id: Optional[str] = None
    created_instance_id: Optional[str] = None
    created_resources: Dict[str, Any] = {}
    validation_results: Dict[str, Any] = {}
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    error_message: Optional[str] = None
    can_retry: bool = True
    logs: List[MigrationLogResponse] = []

    model_config = ConfigDict(from_attributes=True)


# --- Dashboard Overview ---
class DashboardOverviewResponse(BaseModel):
    total_sources: int
    total_targets: int
    total_vms: int
    vms_selected_for_migration: int
    migrations_in_progress: int
    migrations_completed: int
    migrations_failed: int
    recent_activities: List[Dict[str, Any]] = []
    sources_summary: List[Dict[str, Any]] = []
    vms_summary: List[Dict[str, Any]] = []
