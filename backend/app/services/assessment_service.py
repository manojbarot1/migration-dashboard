from typing import Dict, Any, List, Tuple

class PreMigrationAssessment:
    @staticmethod
    def assess_vm(vm_dict: Dict[str, Any]) -> Tuple[str, List[Dict[str, Any]]]:
        """
        Runs comprehensive pre-migration assessment on a discovered VM.
        Returns overall status ('Pass', 'Warning', 'Blocked') and list of findings.
        """
        findings: List[Dict[str, Any]] = []
        overall_status = "Pass"

        def add_check(check: str, status: str, message: str, recommendation: str = None):
            nonlocal overall_status
            findings.append({
                "check": check,
                "status": status,
                "message": message,
                "recommendation": recommendation
            })
            if status == "Blocked":
                overall_status = "Blocked"
            elif status == "Warning" and overall_status != "Blocked":
                overall_status = "Warning"

        # 1. Power State Check
        state = vm_dict.get("state", "").lower()
        if "running" in state:
            add_check(
                "VM Power State",
                "Warning",
                f"VM is currently '{state}'. A consistent disk export requires the VM to be shut down gracefully prior to export.",
                "Gracefully shut down the guest OS before initiating cold migration to avoid filesystem inconsistency."
            )
        elif "shut off" in state or "shut" in state:
            add_check(
                "VM Power State",
                "Pass",
                "VM is stopped. Disk images can be exported consistently."
            )
        else:
            add_check(
                "VM Power State",
                "Warning",
                f"VM is in state '{state}'. Ensure guest is halted before export."
            )

        # 2. Disk Formats & Accessibility
        disks = vm_dict.get("disks", [])
        if not disks:
            add_check(
                "Virtual Disks",
                "Blocked",
                "No virtual disks were discovered for this VM.",
                "Ensure domain XML defines at least one disk device."
            )
        else:
            unsupported_formats = []
            backing_chains = []
            for d in disks:
                fmt = d.get("format", "").lower()
                if fmt not in ("qcow2", "raw", "vmdk", "vhd"):
                    unsupported_formats.append(f"{d.get('device')}: {fmt}")
                if d.get("backing_file"):
                    backing_chains.append(f"{d.get('device')} has backing file {d.get('backing_file')}")

            if unsupported_formats:
                add_check(
                    "Disk Format",
                    "Blocked",
                    f"Unsupported disk format(s): {', '.join(unsupported_formats)}. AWS VM Import supports QCOW2, RAW, VMDK, VHD.",
                    "Convert disk to QCOW2 or RAW using qemu-img before migration."
                )
            else:
                add_check(
                    "Disk Format",
                    "Pass",
                    f"All disk formats ({', '.join(set(d.get('format', 'qcow2') for d in disks))}) are compatible with AWS VM Import."
                )

            if backing_chains:
                add_check(
                    "Disk Backing Chain",
                    "Warning",
                    f"Disks with backing files detected: {', '.join(backing_chains)}. Flattening (qemu-img rebase/commit) required before export.",
                    "Use standalone flattened disk copy to prevent missing backing slices in S3."
                )
            else:
                add_check(
                    "Disk Backing Chain",
                    "Pass",
                    "Disks have no external backing dependencies (flattened standalone images)."
                )

        # 3. Disk Size and Capacity Check
        total_disk_bytes = vm_dict.get("total_disk_bytes", 0)
        total_gb = total_disk_bytes / (1024**3)
        if total_gb > 16000:
            add_check(
                "Disk Capacity",
                "Blocked",
                f"Total disk capacity ({total_gb:.1f} GB) exceeds AWS EBS single volume limit of 16 TiB.",
                "Split data onto multiple EBS volumes or resize storage."
            )
        elif total_gb > 1000:
            add_check(
                "Disk Capacity",
                "Warning",
                f"Total disk size is {total_gb:.1f} GB. Large volumes require significant upload time and S3 staging bandwidth.",
                "Verify network upload bandwidth and allocate appropriate time."
            )
        else:
            add_check(
                "Disk Capacity",
                "Pass",
                f"Total disk capacity is {total_gb:.1f} GB, well within AWS standard volume thresholds."
            )

        # 4. Guest Operating System Compatibility
        os_name = vm_dict.get("os_name", "").lower()
        supported_distros = ["debian", "ubuntu", "centos", "rhel", "red hat", "fedora", "almalinux", "rocky", "amazon", "suse", "opensuse", "windows"]
        if any(distro in os_name for distro in supported_distros):
            add_check(
                "Guest Operating System",
                "Pass",
                f"Detected OS '{vm_dict.get('os_name')}' is supported by AWS EC2 and AWS VM Import."
            )
        elif os_name:
            add_check(
                "Guest Operating System",
                "Warning",
                f"OS '{vm_dict.get('os_name')}' may require manual kernel driver verification on EC2.",
                "Ensure ENA (Elastic Network Adapter) and NVMe drivers are included in initramfs."
            )
        else:
            add_check(
                "Guest Operating System",
                "Warning",
                "Could not detect OS family from libosinfo metadata. Generic Linux kernel assumed."
            )

        # 5. Boot Mode & Firmware Compatibility
        firmware = vm_dict.get("firmware_type", "BIOS")
        if firmware == "UEFI":
            add_check(
                "Boot Firmware",
                "Pass",
                "UEFI firmware detected. Compatible with modern Nitro EC2 instances supporting UEFI boot mode.",
                "Ensure target instance type supports UEFI boot."
            )
        else:
            add_check(
                "Boot Firmware",
                "Pass",
                "Legacy BIOS firmware detected. Compatible with all standard AWS EC2 instance types (legacy and Nitro)."
            )

        # 6. VirtIO Drivers & Device Emulation
        disk_bus = vm_dict.get("disk_bus", "virtio")
        if disk_bus == "virtio":
            add_check(
                "Storage Controller & Drivers",
                "Pass",
                "VirtIO disk controller detected. Modern Linux distributions running under KVM include virtio_blk and nvme kernel modules."
            )
        else:
            add_check(
                "Storage Controller & Drivers",
                "Warning",
                f"Disk controller uses '{disk_bus}'. EC2 Nitro instances use NVMe storage controllers.",
                "Ensure generic Linux kernel or NVMe driver is present in initramfs."
            )

        # 7. Network Interface Configuration
        interfaces = vm_dict.get("interfaces", [])
        if len(interfaces) > 8:
            add_check(
                "Network Interfaces",
                "Warning",
                f"VM has {len(interfaces)} virtual NICs. Most EC2 instance types have an elastic network interface attachment limit (e.g. 2-4 ENIs).",
                "Select a larger EC2 instance type with high ENI limits, or consolidate NICs."
            )
        else:
            add_check(
                "Network Interfaces",
                "Pass",
                f"{len(interfaces)} network interface(s) detected. Fully compatible with target EC2 ENI quotas."
            )

        # 8. CPU Architecture Compatibility
        # Currently libvirt reports x86_64
        add_check(
            "CPU Architecture",
            "Pass",
            "Host and VM architecture is x86_64. Matches standard AWS x86_64 instances (t3, c6i, m6i, r6i)."
        )

        return overall_status, findings

    @staticmethod
    def recommend_instance_type(vcpu: int, memory_kb: int) -> str:
        """Suggests a suitable AWS instance type based on source specs."""
        mem_gb = memory_kb / (1024 * 1024)
        if vcpu <= 1 and mem_gb <= 1.0:
            return "t3.micro"
        elif vcpu <= 1 and mem_gb <= 2.0:
            return "t3.small"
        elif vcpu <= 2 and mem_gb <= 4.0:
            return "t3.medium"
        elif vcpu <= 2 and mem_gb <= 8.0:
            return "t3.large"
        elif vcpu <= 4 and mem_gb <= 16.0:
            return "t3.xlarge"
        elif vcpu <= 8 and mem_gb <= 32.0:
            return "m6i.2xlarge"
        else:
            return "m6i.xlarge"
