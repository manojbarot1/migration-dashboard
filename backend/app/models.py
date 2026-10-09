import uuid
import json
from datetime import datetime
from sqlalchemy import (
    Column, String, Integer, BigInteger, Boolean, DateTime, Text, ForeignKey, Float
)
from sqlalchemy.orm import relationship
from .database import Base
from .utils.crypto import decrypt_value, mask_credential

def generate_uuid():
    return str(uuid.uuid4())

class SourceInfrastructure(Base):
    __tablename__ = "source_infrastructures"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(100), nullable=False)
    environment = Column(String(50), default="Lab")  # Lab, Development, Test, Production
    platform = Column(String(50), default="QEMU/KVM")
    host = Column(String(255), nullable=False)
    port = Column(Integer, default=22)
    username = Column(String(100), nullable=False)
    auth_type = Column(String(20), default="key")  # key, password
    private_key_enc = Column(Text, nullable=True)
    password_enc = Column(Text, nullable=True)
    use_sudo = Column(Boolean, default=False)
    description = Column(Text, nullable=True)
    
    # Status
    status = Column(String(30), default="Not Tested")  # Connected, Failed, Not Tested
    last_checked = Column(DateTime, nullable=True)
    error_message = Column(Text, nullable=True)
    
    # Hypervisor info (JSON string)
    hypervisor_info_raw = Column(Text, nullable=True)

    vms = relationship("DiscoveredVM", back_populates="source", cascade="all, delete-orphan")
    migration_jobs = relationship("MigrationJob", back_populates="source")

    @property
    def hypervisor_info(self):
        if self.hypervisor_info_raw:
            try:
                return json.loads(self.hypervisor_info_raw)
            except Exception:
                return {}
        return {}

    @hypervisor_info.setter
    def hypervisor_info(self, val):
        self.hypervisor_info_raw = json.dumps(val) if val is not None else None

    def get_decrypted_private_key(self) -> str | None:
        return decrypt_value(self.private_key_enc)

    def get_decrypted_password(self) -> str | None:
        return decrypt_value(self.password_enc)


class TargetInfrastructure(Base):
    __tablename__ = "target_infrastructures"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(100), nullable=False)
    account_alias = Column(String(100), nullable=True)
    access_key_id = Column(String(100), nullable=True)
    secret_access_key_enc = Column(Text, nullable=True)
    session_token_enc = Column(Text, nullable=True)
    default_region = Column(String(50), default="us-east-1")
    role_arn = Column(String(255), nullable=True)
    description = Column(Text, nullable=True)

    # Status & discovery
    status = Column(String(30), default="Not Tested")  # Connected, Failed, Not Tested
    account_id = Column(String(50), nullable=True)
    caller_arn = Column(String(255), nullable=True)
    last_checked = Column(DateTime, nullable=True)
    error_message = Column(Text, nullable=True)

    # Cached AWS resources (JSON)
    cached_regions_raw = Column(Text, nullable=True)
    cached_vpcs_raw = Column(Text, nullable=True)
    cached_subnets_raw = Column(Text, nullable=True)
    cached_security_groups_raw = Column(Text, nullable=True)

    migration_jobs = relationship("MigrationJob", back_populates="target")

    def get_decrypted_secret_key(self) -> str | None:
        return decrypt_value(self.secret_access_key_enc)

    def get_decrypted_session_token(self) -> str | None:
        return decrypt_value(self.session_token_enc)

    @property
    def masked_access_key(self) -> str:
        return mask_credential(self.access_key_id, visible_start=4, visible_end=4)

    @property
    def has_secret_key(self) -> bool:
        return bool(self.secret_access_key_enc)

    @property
    def cached_regions(self):
        return json.loads(self.cached_regions_raw) if self.cached_regions_raw else []

    @cached_regions.setter
    def cached_regions(self, val):
        self.cached_regions_raw = json.dumps(val) if val is not None else None

    @property
    def cached_vpcs(self):
        return json.loads(self.cached_vpcs_raw) if self.cached_vpcs_raw else []

    @cached_vpcs.setter
    def cached_vpcs(self, val):
        self.cached_vpcs_raw = json.dumps(val) if val is not None else None

    @property
    def cached_subnets(self):
        return json.loads(self.cached_subnets_raw) if self.cached_subnets_raw else []

    @cached_subnets.setter
    def cached_subnets(self, val):
        self.cached_subnets_raw = json.dumps(val) if val is not None else None

    @property
    def cached_security_groups(self):
        return json.loads(self.cached_security_groups_raw) if self.cached_security_groups_raw else []

    @cached_security_groups.setter
    def cached_security_groups(self, val):
        self.cached_security_groups_raw = json.dumps(val) if val is not None else None


class DiscoveredVM(Base):
    __tablename__ = "discovered_vms"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    source_id = Column(String(36), ForeignKey("source_infrastructures.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(100), nullable=False)
    uuid = Column(String(100), nullable=False)
    state = Column(String(50), default="shut off")  # running, shut off, paused, etc.
    vcpu = Column(Integer, default=1)
    memory_kb = Column(BigInteger, default=1048576)
    os_name = Column(String(100), default="Linux")
    firmware_type = Column(String(50), default="BIOS")  # BIOS, UEFI
    disk_bus = Column(String(50), default="virtio")
    total_disk_bytes = Column(BigInteger, default=0)
    allocated_disk_bytes = Column(BigInteger, default=0)
    
    # Detailed hardware & XML (JSON)
    disks_raw = Column(Text, nullable=True)
    interfaces_raw = Column(Text, nullable=True)
    xml_desc = Column(Text, nullable=True)

    # Pre-migration assessment
    compatibility_status = Column(String(20), default="Warning")  # Pass, Warning, Blocked
    compatibility_reasons_raw = Column(Text, nullable=True)
    last_discovered_at = Column(DateTime, default=datetime.utcnow)

    source = relationship("SourceInfrastructure", back_populates="vms")
    migration_jobs = relationship("MigrationJob", back_populates="vm")

    @property
    def disks(self):
        return json.loads(self.disks_raw) if self.disks_raw else []

    @disks.setter
    def disks(self, val):
        self.disks_raw = json.dumps(val) if val is not None else None

    @property
    def interfaces(self):
        return json.loads(self.interfaces_raw) if self.interfaces_raw else []

    @interfaces.setter
    def interfaces(self, val):
        self.interfaces_raw = json.dumps(val) if val is not None else None

    @property
    def compatibility_reasons(self):
        return json.loads(self.compatibility_reasons_raw) if self.compatibility_reasons_raw else []

    @compatibility_reasons.setter
    def compatibility_reasons(self, val):
        self.compatibility_reasons_raw = json.dumps(val) if val is not None else None


class MigrationJob(Base):
    __tablename__ = "migration_jobs"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(150), nullable=False)
    source_id = Column(String(36), ForeignKey("source_infrastructures.id"), nullable=False)
    target_id = Column(String(36), ForeignKey("target_infrastructures.id"), nullable=False)
    vm_id = Column(String(36), ForeignKey("discovered_vms.id"), nullable=False)
    vm_name = Column(String(100), nullable=False)

    # Job tracking
    # Statuses: Pending, Validating, Preparing source, Exporting disks, Uploading disks,
    #           Importing image, Launching EC2, Validating target, Completed,
    #           Completed with warnings, Failed, Cancelled
    status = Column(String(50), default="Pending")
    phase = Column(String(50), default="Validation")
    progress_pct = Column(Integer, default=0)
    
    # Target selections
    target_region = Column(String(50), default="us-east-1")
    target_vpc_id = Column(String(100), nullable=True)
    target_subnet_id = Column(String(100), nullable=True)
    target_security_group_ids_raw = Column(Text, nullable=True)
    target_instance_type = Column(String(50), default="t3.small")
    target_instance_name = Column(String(150), nullable=True)
    target_disk_type = Column(String(20), default="gp3")
    target_disk_size_gb = Column(Integer, default=50)
    assign_public_ip = Column(Boolean, default=False)
    iam_instance_profile = Column(String(100), nullable=True)
    s3_bucket = Column(String(100), nullable=True)

    # Output AWS resources
    created_ami_id = Column(String(100), nullable=True)
    created_instance_id = Column(String(100), nullable=True)
    created_resources_raw = Column(Text, nullable=True)
    validation_results_raw = Column(Text, nullable=True)
    
    # Execution metadata
    start_time = Column(DateTime, nullable=True)
    end_time = Column(DateTime, nullable=True)
    error_message = Column(Text, nullable=True)
    can_retry = Column(Boolean, default=True)

    source = relationship("SourceInfrastructure", back_populates="migration_jobs")
    target = relationship("TargetInfrastructure", back_populates="migration_jobs")
    vm = relationship("DiscoveredVM", back_populates="migration_jobs")
    logs = relationship("MigrationLog", back_populates="job", cascade="all, delete-orphan", order_by="MigrationLog.timestamp")

    @property
    def target_security_group_ids(self):
        return json.loads(self.target_security_group_ids_raw) if self.target_security_group_ids_raw else []

    @target_security_group_ids.setter
    def target_security_group_ids(self, val):
        self.target_security_group_ids_raw = json.dumps(val) if val is not None else None

    @property
    def created_resources(self):
        return json.loads(self.created_resources_raw) if self.created_resources_raw else {}

    @created_resources.setter
    def created_resources(self, val):
        self.created_resources_raw = json.dumps(val) if val is not None else None

    @property
    def validation_results(self):
        return json.loads(self.validation_results_raw) if self.validation_results_raw else {}

    @validation_results.setter
    def validation_results(self, val):
        self.validation_results_raw = json.dumps(val) if val is not None else None


class MigrationLog(Base):
    __tablename__ = "migration_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    job_id = Column(String(36), ForeignKey("migration_jobs.id", ondelete="CASCADE"), nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)
    level = Column(String(20), default="INFO")  # INFO, WARNING, ERROR, SUCCESS
    phase = Column(String(50), default="General")
    message = Column(Text, nullable=False)
    details_raw = Column(Text, nullable=True)

    job = relationship("MigrationJob", back_populates="logs")

    @property
    def details(self):
        return json.loads(self.details_raw) if self.details_raw else {}

    @details.setter
    def details(self, val):
        self.details_raw = json.dumps(val) if val is not None else None
