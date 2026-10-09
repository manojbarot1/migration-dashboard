from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc
from datetime import datetime
from typing import List

from ..database import get_db
from ..models import MigrationJob, MigrationLog, DiscoveredVM, TargetInfrastructure, SourceInfrastructure
from ..schemas import (
    MigrationPlanRequest, MigrationPlanResponse, VMPlanSummary,
    MigrationJobCreate, MigrationJobResponse, MigrationLogResponse
)
from ..services.migration_engine import MigrationEngine
from ..services.assessment_service import PreMigrationAssessment

router = APIRouter(prefix="/api/migration", tags=["Migration Execution"])

def _to_job_response(j: MigrationJob) -> MigrationJobResponse:
    logs = [
        MigrationLogResponse(
            id=log.id,
            job_id=log.job_id,
            timestamp=log.timestamp,
            level=log.level,
            phase=log.phase,
            message=log.message,
            details=log.details
        ) for log in j.logs
    ]

    return MigrationJobResponse(
        id=j.id,
        name=j.name,
        source_id=j.source_id,
        target_id=j.target_id,
        vm_id=j.vm_id,
        vm_name=j.vm_name,
        status=j.status,
        phase=j.phase,
        progress_pct=j.progress_pct,
        target_region=j.target_region,
        target_vpc_id=j.target_vpc_id,
        target_subnet_id=j.target_subnet_id,
        target_security_group_ids=j.target_security_group_ids,
        target_instance_type=j.target_instance_type,
        target_instance_name=j.target_instance_name,
        target_disk_type=j.target_disk_type,
        target_disk_size_gb=j.target_disk_size_gb,
        assign_public_ip=j.assign_public_ip,
        created_ami_id=j.created_ami_id,
        created_instance_id=j.created_instance_id,
        created_resources=j.created_resources,
        validation_results=j.validation_results,
        start_time=j.start_time,
        end_time=j.end_time,
        error_message=j.error_message,
        can_retry=j.can_retry,
        logs=logs
    )

@router.post("/plan", response_model=MigrationPlanResponse)
def generate_migration_plan(payload: MigrationPlanRequest, db: Session = Depends(get_db)):
    source = db.query(SourceInfrastructure).filter(SourceInfrastructure.id == payload.source_id).first()
    target = db.query(TargetInfrastructure).filter(TargetInfrastructure.id == payload.target_id).first()
    if not source or not target:
        raise HTTPException(status_code=400, detail="Invalid source or target infrastructure ID")

    blockers = []
    warnings = []
    vm_summaries = []
    total_transfer_gb = 0.0

    # Validate target network selection against cached or requested resources
    if not payload.target_vpc_id or not payload.target_subnet_id:
        blockers.append("Both Destination VPC and Subnet must be specified.")

    vms = db.query(DiscoveredVM).filter(DiscoveredVM.id.in_(payload.vm_ids)).all()
    if not vms:
        blockers.append("No valid source VMs selected for migration.")

    for v in vms:
        vm_warns = []
        vm_blocks = []
        disk_gb = round(v.total_disk_bytes / (1024**3), 2)
        total_transfer_gb += disk_gb

        if v.compatibility_status == "Blocked":
            vm_blocks.append(f"Pre-migration assessment blocked for {v.name}. Resolve blocking issues before migration.")
        elif v.compatibility_status == "Warning":
            vm_warns.append(f"Pre-migration assessment warning on {v.name}. Review device drivers and cold shutdown requirement.")

        if "running" in v.state.lower():
            vm_warns.append(f"VM is running: Graceful shutdown is required before image export to guarantee data consistency.")

        vm_summaries.append(VMPlanSummary(
            vm_id=v.id,
            vm_name=v.name,
            source_vcpus=v.vcpu,
            source_memory_mb=round(v.memory_kb / 1024, 1),
            source_disk_gb=disk_gb,
            target_instance_type=payload.target_instance_type,
            target_disk_type=payload.target_disk_type,
            target_disk_size_gb=max(int(disk_gb), 50),
            compatibility_status=v.compatibility_status,
            warnings=vm_warns,
            blockers=vm_blocks
        ))

    cost_warnings = [
        "Amazon EC2: On-Demand compute charges apply for the running instance.",
        f"Amazon EBS: {payload.target_disk_type.upper()} volume storage provisioned.",
        "Amazon S3: Temporary staging bucket storage during disk image import.",
        "AWS VM Import/Export: No separate charge for VM Import, standard S3 and EBS rates apply."
    ]

    actions_summary = [
        "1. Verify source VM is powered off for consistent cold snapshot.",
        "2. Export disk metadata and validate image format using qemu-img.",
        "3. Stage disk image to AWS S3 bucket and trigger VM import task.",
        "4. Register resulting Amazon Machine Image (AMI).",
        f"5. Provision EC2 instance ({payload.target_instance_type}) in Subnet {payload.target_subnet_id}.",
        "6. Perform post-launch hypervisor and network validation."
    ]

    return MigrationPlanResponse(
        is_valid=len(blockers) == 0,
        blockers=blockers,
        warnings=warnings,
        vms=vm_summaries,
        target_region=payload.target_region,
        target_vpc_name=payload.target_vpc_id,
        target_subnet_cidr=payload.target_subnet_id,
        estimated_data_transfer_gb=round(total_transfer_gb, 2),
        cost_warnings=cost_warnings,
        actions_summary=actions_summary,
        downtime_notice="Cold migration requires source guest shutdown. Source VM will not be modified or deleted automatically."
    )

@router.post("/jobs", response_model=List[MigrationJobResponse])
def create_migration_jobs(payloads: List[MigrationJobCreate], db: Session = Depends(get_db)):
    created_jobs = []
    for p in payloads:
        vm = db.query(DiscoveredVM).filter(DiscoveredVM.id == p.vm_id).first()
        if not vm:
            continue

        disk_size = p.target_disk_size_gb or max(int(vm.total_disk_bytes / (1024**3)), 50)
        job = MigrationJob(
            name=f"Migrate {vm.name} to {p.target_region}",
            source_id=p.source_id,
            target_id=p.target_id,
            vm_id=p.vm_id,
            vm_name=vm.name,
            status="Pending",
            phase="Queued",
            progress_pct=0,
            target_region=p.target_region,
            target_vpc_id=p.target_vpc_id,
            target_subnet_id=p.target_subnet_id,
            target_security_group_ids=p.target_security_group_ids,
            target_instance_type=p.target_instance_type,
            target_instance_name=p.target_instance_name or f"migrated-{vm.name}",
            target_disk_type=p.target_disk_type,
            target_disk_size_gb=disk_size,
            assign_public_ip=p.assign_public_ip,
            iam_instance_profile=p.iam_instance_profile,
            s3_bucket=p.s3_bucket,
        )
        db.add(job)
        db.commit()
        db.refresh(job)

        # Trigger background execution
        MigrationEngine.start_job(job.id)
        created_jobs.append(_to_job_response(job))

    return created_jobs

@router.get("/jobs", response_model=List[MigrationJobResponse])
def list_migration_jobs(db: Session = Depends(get_db)):
    jobs = db.query(MigrationJob).order_by(desc(MigrationJob.start_time)).all()
    return [_to_job_response(j) for j in jobs]

@router.get("/jobs/{id}", response_model=MigrationJobResponse)
def get_migration_job(id: str, db: Session = Depends(get_db)):
    job = db.query(MigrationJob).filter(MigrationJob.id == id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Migration job not found")
    return _to_job_response(job)

@router.post("/jobs/{id}/cancel")
def cancel_migration_job(id: str, db: Session = Depends(get_db)):
    job = db.query(MigrationJob).filter(MigrationJob.id == id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Migration job not found")

    cancelled = MigrationEngine.cancel_job(id)
    return {"success": cancelled, "message": "Migration cancellation requested."}

@router.post("/jobs/{id}/retry", response_model=MigrationJobResponse)
def retry_migration_job(id: str, db: Session = Depends(get_db)):
    job = db.query(MigrationJob).filter(MigrationJob.id == id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Migration job not found")

    if job.status not in ("Failed", "Cancelled"):
        raise HTTPException(status_code=400, detail="Only failed or cancelled jobs can be retried.")

    job.status = "Pending"
    job.phase = "Retrying"
    job.progress_pct = 0
    job.error_message = None
    job.start_time = datetime.utcnow()
    job.end_time = None
    db.commit()

    MigrationEngine.start_job(job.id)
    return _to_job_response(job)
