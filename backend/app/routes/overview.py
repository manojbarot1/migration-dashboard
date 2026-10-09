from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import desc
from ..database import get_db
from ..models import SourceInfrastructure, TargetInfrastructure, DiscoveredVM, MigrationJob, MigrationLog
from ..schemas import DashboardOverviewResponse

router = APIRouter(prefix="/api/overview", tags=["Dashboard Overview"])

@router.get("", response_model=DashboardOverviewResponse)
def get_overview(db: Session = Depends(get_db)):
    total_sources = db.query(SourceInfrastructure).count()
    total_targets = db.query(TargetInfrastructure).count()
    total_vms = db.query(DiscoveredVM).count()

    migrations_in_progress = db.query(MigrationJob).filter(
        MigrationJob.status.in_(["Pending", "Validating", "Preparing source", "Exporting disks", "Uploading disks", "Importing image", "Launching EC2", "Validating target"])
    ).count()

    migrations_completed = db.query(MigrationJob).filter(
        MigrationJob.status.in_(["Completed", "Completed with warnings"])
    ).count()

    migrations_failed = db.query(MigrationJob).filter(
        MigrationJob.status.in_(["Failed", "Cancelled"])
    ).count()

    # Recent activities from migration logs & jobs
    recent_jobs = db.query(MigrationJob).order_by(desc(MigrationJob.start_time)).limit(10).all()
    recent_activities = []
    for j in recent_jobs:
        recent_activities.append({
            "id": j.id,
            "type": "migration",
            "name": f"Migration: {j.vm_name}",
            "status": j.status,
            "phase": j.phase,
            "progress_pct": j.progress_pct,
            "created_instance_id": j.created_instance_id,
            "time": j.start_time.isoformat() if j.start_time else None
        })

    # Sources summary
    sources = db.query(SourceInfrastructure).all()
    sources_summary = [{
        "id": s.id,
        "name": s.name,
        "host": s.host,
        "platform": s.platform,
        "status": s.status,
        "vm_count": len(s.vms)
    } for s in sources]

    # VMs summary
    vms = db.query(DiscoveredVM).limit(10).all()
    vms_summary = [{
        "id": v.id,
        "name": v.name,
        "source_name": v.source.name if v.source else None,
        "state": v.state,
        "os_name": v.os_name,
        "vcpu": v.vcpu,
        "memory_mb": round(v.memory_kb / 1024, 1),
        "total_disk_gb": round(v.total_disk_bytes / (1024**3), 2),
        "compatibility_status": v.compatibility_status
    } for v in vms]

    return {
        "total_sources": total_sources,
        "total_targets": total_targets,
        "total_vms": total_vms,
        "vms_selected_for_migration": 0,
        "migrations_in_progress": migrations_in_progress,
        "migrations_completed": migrations_completed,
        "migrations_failed": migrations_failed,
        "recent_activities": recent_activities,
        "sources_summary": sources_summary,
        "vms_summary": vms_summary
    }
