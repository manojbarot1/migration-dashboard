from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime
from typing import List

from ..database import get_db
from ..models import SourceInfrastructure, DiscoveredVM
from ..schemas import (
    SourceInfraCreate, SourceInfraUpdate, SourceInfraResponse, TestSourceResponse
)
from ..utils.crypto import encrypt_value
from ..services.ssh_client import SSHExecutor
from ..services.libvirt_discovery import LibvirtDiscoveryService
from ..services.assessment_service import PreMigrationAssessment

router = APIRouter(prefix="/api/sources", tags=["Source Infrastructure"])

def _to_response(s: SourceInfrastructure) -> SourceInfraResponse:
    return SourceInfraResponse(
        id=s.id,
        name=s.name,
        environment=s.environment,
        platform=s.platform,
        host=s.host,
        port=s.port,
        username=s.username,
        auth_type=s.auth_type,
        use_sudo=s.use_sudo,
        description=s.description,
        status=s.status,
        last_checked=s.last_checked,
        error_message=s.error_message,
        hypervisor_info=s.hypervisor_info,
        vm_count=len(s.vms)
    )

@router.get("", response_model=List[SourceInfraResponse])
def list_sources(db: Session = Depends(get_db)):
    sources = db.query(SourceInfrastructure).all()
    return [_to_response(s) for s in sources]

@router.post("", response_model=SourceInfraResponse)
def create_source(payload: SourceInfraCreate, db: Session = Depends(get_db)):
    source = SourceInfrastructure(
        name=payload.name,
        environment=payload.environment,
        platform=payload.platform,
        host=payload.host,
        port=payload.port,
        username=payload.username,
        auth_type=payload.auth_type,
        use_sudo=payload.use_sudo,
        description=payload.description,
        private_key_enc=encrypt_value(payload.private_key),
        password_enc=encrypt_value(payload.password),
        status="Not Tested"
    )
    db.add(source)
    db.commit()
    db.refresh(source)
    return _to_response(source)

@router.get("/{id}", response_model=SourceInfraResponse)
def get_source(id: str, db: Session = Depends(get_db)):
    source = db.query(SourceInfrastructure).filter(SourceInfrastructure.id == id).first()
    if not source:
        raise HTTPException(status_code=404, detail="Source infrastructure not found")
    return _to_response(source)

@router.put("/{id}", response_model=SourceInfraResponse)
def update_source(id: str, payload: SourceInfraUpdate, db: Session = Depends(get_db)):
    source = db.query(SourceInfrastructure).filter(SourceInfrastructure.id == id).first()
    if not source:
        raise HTTPException(status_code=404, detail="Source infrastructure not found")

    if payload.name is not None: source.name = payload.name
    if payload.environment is not None: source.environment = payload.environment
    if payload.host is not None: source.host = payload.host
    if payload.port is not None: source.port = payload.port
    if payload.username is not None: source.username = payload.username
    if payload.auth_type is not None: source.auth_type = payload.auth_type
    if payload.use_sudo is not None: source.use_sudo = payload.use_sudo
    if payload.description is not None: source.description = payload.description
    if payload.private_key is not None: source.private_key_enc = encrypt_value(payload.private_key)
    if payload.password is not None: source.password_enc = encrypt_value(payload.password)

    db.commit()
    db.refresh(source)
    return _to_response(source)

@router.delete("/{id}")
def delete_source(id: str, db: Session = Depends(get_db)):
    source = db.query(SourceInfrastructure).filter(SourceInfrastructure.id == id).first()
    if not source:
        raise HTTPException(status_code=404, detail="Source infrastructure not found")
    db.delete(source)
    db.commit()
    return {"message": "Source infrastructure deleted successfully"}

@router.post("/{id}/test", response_model=TestSourceResponse)
def test_source_connection(id: str, db: Session = Depends(get_db)):
    source = db.query(SourceInfrastructure).filter(SourceInfrastructure.id == id).first()
    if not source:
        raise HTTPException(status_code=404, detail="Source infrastructure not found")

    ssh = SSHExecutor(
        host=source.host,
        port=source.port,
        username=source.username,
        auth_type=source.auth_type,
        private_key=source.get_decrypted_private_key(),
        password=source.get_decrypted_password()
    )

    discovery = LibvirtDiscoveryService(ssh)
    res = discovery.test_prerequisites()

    source.last_checked = datetime.utcnow()
    if res["success"]:
        source.status = "Connected"
        source.error_message = None
        source.hypervisor_info = {
            "hostname": res.get("hypervisor_hostname"),
            "libvirt_version": res.get("libvirt_version"),
            "hypervisor_version": res.get("hypervisor_version"),
            "cpu_model": res.get("cpu_model"),
            "total_memory_gb": res.get("total_memory_gb"),
        }
    else:
        source.status = "Failed"
        source.error_message = res.get("message")

    db.commit()
    return res

@router.post("/{id}/discover")
def discover_vms(id: str, db: Session = Depends(get_db)):
    source = db.query(SourceInfrastructure).filter(SourceInfrastructure.id == id).first()
    if not source:
        raise HTTPException(status_code=404, detail="Source infrastructure not found")

    ssh = SSHExecutor(
        host=source.host,
        port=source.port,
        username=source.username,
        auth_type=source.auth_type,
        private_key=source.get_decrypted_private_key(),
        password=source.get_decrypted_password()
    )

    discovery = LibvirtDiscoveryService(ssh)
    raw_vms = discovery.discover_vms()

    discovered_objects = []
    for vm_data in raw_vms:
        # Check if already exists for this source
        existing = db.query(DiscoveredVM).filter(
            DiscoveredVM.source_id == source.id,
            DiscoveredVM.name == vm_data["name"]
        ).first()

        # Run pre-migration assessment
        overall_status, findings = PreMigrationAssessment.assess_vm(vm_data)

        if not existing:
            vm_obj = DiscoveredVM(
                source_id=source.id,
                name=vm_data["name"],
                uuid=vm_data.get("uuid", ""),
                state=vm_data.get("state", "shut off"),
                vcpu=vm_data.get("vcpu", 1),
                memory_kb=vm_data.get("memory_kb", 1048576),
                os_name=vm_data.get("os_name", "Linux"),
                firmware_type=vm_data.get("firmware_type", "BIOS"),
                disk_bus=vm_data.get("disk_bus", "virtio"),
                total_disk_bytes=vm_data.get("total_disk_bytes", 0),
                allocated_disk_bytes=vm_data.get("allocated_disk_bytes", 0),
                disks=vm_data.get("disks", []),
                interfaces=vm_data.get("interfaces", []),
                xml_desc=vm_data.get("xml_desc", ""),
                compatibility_status=overall_status,
                compatibility_reasons=findings,
                last_discovered_at=datetime.utcnow()
            )
            db.add(vm_obj)
            discovered_objects.append(vm_obj)
        else:
            existing.uuid = vm_data.get("uuid", existing.uuid)
            existing.state = vm_data.get("state", existing.state)
            existing.vcpu = vm_data.get("vcpu", existing.vcpu)
            existing.memory_kb = vm_data.get("memory_kb", existing.memory_kb)
            existing.os_name = vm_data.get("os_name", existing.os_name)
            existing.firmware_type = vm_data.get("firmware_type", existing.firmware_type)
            existing.disk_bus = vm_data.get("disk_bus", existing.disk_bus)
            existing.total_disk_bytes = vm_data.get("total_disk_bytes", 0)
            existing.allocated_disk_bytes = vm_data.get("allocated_disk_bytes", 0)
            existing.disks = vm_data.get("disks", [])
            existing.interfaces = vm_data.get("interfaces", [])
            existing.xml_desc = vm_data.get("xml_desc", existing.xml_desc)
            existing.compatibility_status = overall_status
            existing.compatibility_reasons = findings
            existing.last_discovered_at = datetime.utcnow()
            discovered_objects.append(existing)

    source.status = "Connected"
    source.last_checked = datetime.utcnow()
    db.commit()

    return {
        "success": True,
        "count": len(discovered_objects),
        "message": f"Successfully discovered {len(discovered_objects)} VM(s) on {source.name}"
    }
