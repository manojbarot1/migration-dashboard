from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from ..database import get_db
from ..models import DiscoveredVM
from ..schemas import DiscoveredVMResponse
from ..services.assessment_service import PreMigrationAssessment

router = APIRouter(prefix="/api/vms", tags=["VM Inventory"])

def _to_vm_response(v: DiscoveredVM) -> DiscoveredVMResponse:
    disks = v.disks or []
    interfaces = v.interfaces or []
    reasons = v.compatibility_reasons or []

    return DiscoveredVMResponse(
        id=v.id,
        source_id=v.source_id,
        source_name=v.source.name if v.source else None,
        name=v.name,
        uuid=v.uuid,
        state=v.state,
        vcpu=v.vcpu,
        memory_kb=v.memory_kb,
        memory_mb=round(v.memory_kb / 1024, 1),
        os_name=v.os_name,
        firmware_type=v.firmware_type,
        disk_bus=v.disk_bus,
        total_disk_bytes=v.total_disk_bytes,
        total_disk_gb=round(v.total_disk_bytes / (1024**3), 2),
        allocated_disk_bytes=v.allocated_disk_bytes,
        allocated_disk_gb=round(v.allocated_disk_bytes / (1024**3), 2),
        disks=disks,
        interfaces=interfaces,
        xml_desc=v.xml_desc,
        compatibility_status=v.compatibility_status,
        compatibility_reasons=reasons,
        last_discovered_at=v.last_discovered_at
    )

@router.get("", response_model=List[DiscoveredVMResponse])
def list_vms(
    source_id: Optional[str] = Query(None),
    state: Optional[str] = Query(None),
    os: Optional[str] = Query(None),
    compatibility: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    query = db.query(DiscoveredVM)
    if source_id:
        query = query.filter(DiscoveredVM.source_id == source_id)
    if state:
        query = query.filter(DiscoveredVM.state == state)
    if os:
        query = query.filter(DiscoveredVM.os_name.ilike(f"%{os}%"))
    if compatibility:
        query = query.filter(DiscoveredVM.compatibility_status == compatibility)

    vms = query.all()
    return [_to_vm_response(v) for v in vms]

@router.get("/graph/dependencies")
def get_all_dependencies(db: Session = Depends(get_db)):
    """Discovers application dependency topology, tiers, and move groups."""
    from ..services.dependency_service import DependencyDiscoveryService
    vms = db.query(DiscoveredVM).all()
    res = DependencyDiscoveryService.analyze_dependencies(vms)
    return res

@router.post("/grouping/suggestions")
def get_grouping_suggestions(payload: dict, db: Session = Depends(get_db)):
    """
    Given a list of currently selected VM IDs:
    - Identifies missing dependent servers
    - Suggests complete move groups / migration waves
    - Calculates cross-cloud latency & communication risk
    """
    from ..services.dependency_service import DependencyDiscoveryService
    selected_ids = payload.get("selected_vm_ids", [])
    all_vms = db.query(DiscoveredVM).all()
    graph = DependencyDiscoveryService.analyze_dependencies(all_vms)

    id_to_vm = {v.id: v for v in all_vms}
    name_to_vm = {v.name: v for v in all_vms}
    selected_names = set(id_to_vm[vid].name for vid in selected_ids if vid in id_to_vm)

    missing_dependencies = []
    missing_dependents = []
    recommended_vms_to_add = set()
    warnings = []
    suggested_move_groups = []

    for name in selected_names:
        node = next((n for n in graph["nodes"] if n["name"] == name), None)
        if not node:
            continue

        # Downstream dependencies (servers this VM needs)
        for dep in node.get("dependencies", []):
            target_name = dep["target"]
            if target_name not in selected_names:
                missing_dependencies.append({
                    "selected_server": name,
                    "required_server": target_name,
                    "protocol": dep.get("protocol"),
                    "reason": dep.get("reason"),
                    "criticality": dep.get("criticality")
                })
                recommended_vms_to_add.add(target_name)
                warnings.append(
                    f"Server '{name}' connects to downstream database/backend '{target_name}'. "
                    f"Migrating '{name}' without '{target_name}' will introduce network latency across cloud boundaries."
                )

        # Upstream dependents (servers that will break without this VM)
        for dep in node.get("dependents", []):
            src_name = dep["source"]
            if src_name not in selected_names:
                missing_dependents.append({
                    "selected_server": name,
                    "dependent_server": src_name,
                    "protocol": dep.get("protocol"),
                    "reason": dep.get("reason"),
                    "criticality": dep.get("criticality")
                })
                recommended_vms_to_add.add(src_name)
                warnings.append(
                    f"Upstream server '{src_name}' relies on '{name}'. "
                    f"If you migrate '{name}' first, '{src_name}' may fail to connect until it is also migrated."
                )

    # Find matching move groups
    for g in graph["move_groups"]:
        intersect = set(g["vm_names"]).intersection(selected_names)
        if intersect:
            suggested_move_groups.append(g)

    recommended_vm_ids = [name_to_vm[n].id for n in recommended_vms_to_add if n in name_to_vm]

    return {
        "selected_vm_count": len(selected_ids),
        "is_complete_group": len(recommended_vms_to_add) == 0,
        "missing_dependencies": missing_dependencies,
        "missing_dependents": missing_dependents,
        "recommended_vm_names": list(recommended_vms_to_add),
        "recommended_vm_ids": recommended_vm_ids,
        "warnings": warnings,
        "suggested_move_groups": suggested_move_groups
    }

@router.get("/{id}", response_model=DiscoveredVMResponse)
def get_vm(id: str, db: Session = Depends(get_db)):
    vm = db.query(DiscoveredVM).filter(DiscoveredVM.id == id).first()
    if not vm:
        raise HTTPException(status_code=404, detail="Discovered VM not found")
    return _to_vm_response(vm)

@router.post("/{id}/assess", response_model=DiscoveredVMResponse)
def reassess_vm(id: str, db: Session = Depends(get_db)):
    vm = db.query(DiscoveredVM).filter(DiscoveredVM.id == id).first()
    if not vm:
        raise HTTPException(status_code=404, detail="Discovered VM not found")

    vm_dict = {
        "name": vm.name,
        "state": vm.state,
        "os_name": vm.os_name,
        "firmware_type": vm.firmware_type,
        "disk_bus": vm.disk_bus,
        "total_disk_bytes": vm.total_disk_bytes,
        "disks": vm.disks,
        "interfaces": vm.interfaces
    }
    status, reasons = PreMigrationAssessment.assess_vm(vm_dict)
    vm.compatibility_status = status
    vm.compatibility_reasons = reasons
    db.commit()
    db.refresh(vm)
    return _to_vm_response(vm)



