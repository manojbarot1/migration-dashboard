import pytest
from app.services.assessment_service import PreMigrationAssessment

def test_assessment_running_vm():
    vm_data = {
        "state": "running",
        "os_name": "Debian 13",
        "firmware_type": "BIOS",
        "disk_bus": "virtio",
        "total_disk_bytes": 53687091200,
        "disks": [{"device": "vda", "format": "qcow2", "capacity_bytes": 53687091200}],
        "interfaces": [{"mac": "52:54:00:1b:5b:66"}]
    }
    status, findings = PreMigrationAssessment.assess_vm(vm_data)
    assert status == "Warning"
    checks = {f["check"]: f["status"] for f in findings}
    assert checks["VM Power State"] == "Warning"
    assert checks["Disk Format"] == "Pass"
    assert checks["Guest Operating System"] == "Pass"

def test_assessment_cold_vm_pass():
    vm_data = {
        "state": "shut off",
        "os_name": "Debian 13",
        "firmware_type": "BIOS",
        "disk_bus": "virtio",
        "total_disk_bytes": 53687091200,
        "disks": [{"device": "vda", "format": "qcow2", "capacity_bytes": 53687091200}],
        "interfaces": [{"mac": "52:54:00:1b:5b:66"}]
    }
    status, findings = PreMigrationAssessment.assess_vm(vm_data)
    assert status == "Pass"

def test_assessment_blocked_unsupported_disk():
    vm_data = {
        "state": "shut off",
        "os_name": "Debian 13",
        "firmware_type": "BIOS",
        "disk_bus": "virtio",
        "total_disk_bytes": 53687091200,
        "disks": [{"device": "vda", "format": "iso", "capacity_bytes": 53687091200}],
        "interfaces": [{"mac": "52:54:00:1b:5b:66"}]
    }
    status, findings = PreMigrationAssessment.assess_vm(vm_data)
    assert status == "Blocked"
    assert any(f["check"] == "Disk Format" and f["status"] == "Blocked" for f in findings)

def test_recommend_instance_type():
    rec = PreMigrationAssessment.recommend_instance_type(1, 1048576)
    assert rec == "t3.micro"
    rec2 = PreMigrationAssessment.recommend_instance_type(2, 4194304)
    assert rec2 == "t3.medium"
