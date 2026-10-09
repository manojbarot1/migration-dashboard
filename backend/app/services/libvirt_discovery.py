import re
import xml.etree.ElementTree as ET
from typing import Dict, Any, List, Tuple
from .ssh_client import SSHExecutor

class LibvirtDiscoveryService:
    def __init__(self, ssh: SSHExecutor):
        self.ssh = ssh

    def test_prerequisites(self) -> Dict[str, Any]:
        """Tests SSH, virsh, libvirt daemon and returns diagnostics."""
        result = {
            "success": False,
            "ssh_connected": False,
            "virsh_available": False,
            "libvirt_accessible": False,
            "hypervisor_hostname": None,
            "libvirt_version": None,
            "hypervisor_version": None,
            "cpu_model": None,
            "total_memory_gb": None,
            "message": "",
            "missing_prerequisites": []
        }

        # 1. Test SSH
        ssh_ok, ssh_msg = self.ssh.test_connection()
        result["ssh_connected"] = ssh_ok
        if not ssh_ok:
            result["message"] = f"SSH connection failed: {ssh_msg}"
            result["missing_prerequisites"].append({
                "component": "SSH Access",
                "issue": ssh_msg,
                "remediation": "Check host IP, SSH port, username, and ensure your SSH key is authorized in ~/.ssh/authorized_keys."
            })
            return result

        # 2. Test virsh installed
        code, out, err = self.ssh.execute("which virsh")
        if code != 0:
            result["message"] = "virsh CLI not found on host"
            result["missing_prerequisites"].append({
                "component": "virsh CLI",
                "issue": "virsh command is not installed on the target machine",
                "remediation": "Run 'sudo apt-get update && sudo apt-get install -y libvirt-clients libvirt-daemon-system qemu-kvm' on the host."
            })
            return result
        result["virsh_available"] = True

        # 3. Test libvirt connection & permissions
        code, out, err = self.ssh.execute("virsh version")
        if code != 0:
            result["message"] = "Cannot connect to libvirt hypervisor"
            result["missing_prerequisites"].append({
                "component": "libvirt daemon & permissions",
                "issue": f"virsh version returned error: {err.strip()}",
                "remediation": f"Ensure libvirtd service is active ('sudo systemctl status libvirtd') and add your user to the libvirt group: 'sudo usermod -aG libvirt,kvm {self.ssh.username}'."
            })
            return result
        result["libvirt_accessible"] = True

        # Parse versions
        for line in out.splitlines():
            line = line.strip()
            if "Using library: libvirt" in line:
                result["libvirt_version"] = line.split("libvirt")[-1].strip()
            elif "Running hypervisor:" in line:
                result["hypervisor_version"] = line.split("Running hypervisor:")[-1].strip()

        # 4. Hostname & Nodeinfo
        code, hostname_out, _ = self.ssh.execute("hostname -f || hostname")
        if code == 0:
            result["hypervisor_hostname"] = hostname_out.strip()

        code, node_out, _ = self.ssh.execute("virsh nodeinfo")
        if code == 0:
            for line in node_out.splitlines():
                if "CPU model:" in line:
                    result["cpu_model"] = line.split(":")[-1].strip()
                elif "Memory size:" in line:
                    # value in KiB
                    try:
                        mem_kib = int(line.split(":")[-1].strip().split()[0])
                        result["total_memory_gb"] = round(mem_kib / (1024 * 1024), 2)
                    except Exception:
                        pass

        result["success"] = True
        result["message"] = f"Connected successfully to {result['hypervisor_hostname'] or 'hypervisor'} running libvirt {result['libvirt_version'] or ''}"
        return result

    def discover_vms(self) -> List[Dict[str, Any]]:
        """Discovers all VMs running or shut off on the QEMU/KVM host."""
        vms = []
        # Get list of domains
        code, out, err = self.ssh.execute("virsh list --all --name")
        if code != 0:
            raise RuntimeError(f"Failed to list virsh domains: {err or out}")

        domain_names = [line.strip() for line in out.splitlines() if line.strip()]

        for name in domain_names:
            try:
                vm_data = self._inspect_domain(name)
                vms.append(vm_data)
            except Exception as e:
                # Still record minimal VM info if XML parse fails
                vms.append({
                    "name": name,
                    "uuid": "unknown",
                    "state": "unknown",
                    "vcpu": 1,
                    "memory_kb": 1048576,
                    "os_name": "Linux",
                    "firmware_type": "BIOS",
                    "disk_bus": "virtio",
                    "total_disk_bytes": 0,
                    "allocated_disk_bytes": 0,
                    "disks": [],
                    "interfaces": [],
                    "xml_desc": f"Error inspecting VM: {str(e)}",
                    "error": str(e)
                })

        return vms

    def _inspect_domain(self, name: str) -> Dict[str, Any]:
        # 1. State from dominfo
        state = "shut off"
        code, info_out, _ = self.ssh.execute(f"virsh dominfo '{name}'")
        if code == 0:
            for line in info_out.splitlines():
                if line.startswith("State:"):
                    state = line.split(":", 1)[1].strip()

        # 2. Full XML
        code, xml_out, err = self.ssh.execute(f"virsh dumpxml '{name}'")
        if code != 0:
            raise RuntimeError(f"virsh dumpxml failed: {err}")

        root = ET.fromstring(xml_out)

        uuid_elem = root.find("uuid")
        uuid_str = uuid_elem.text.strip() if uuid_elem is not None and uuid_elem.text else ""

        vcpu_elem = root.find("vcpu")
        vcpu = int(vcpu_elem.text.strip()) if vcpu_elem is not None and vcpu_elem.text else 1

        memory_elem = root.find("memory")
        memory_kb = int(memory_elem.text.strip()) if memory_elem is not None and memory_elem.text else 1048576

        # Detect firmware / loader
        firmware_type = "BIOS"
        os_elem = root.find("os")
        if os_elem is not None:
            loader = os_elem.find("loader")
            if loader is not None and ("OVMF" in (loader.text or "") or "code" in (loader.text or "")):
                firmware_type = "UEFI"
            elif os_elem.get("firmware") == "efi":
                firmware_type = "UEFI"

        # Detect OS Name from metadata
        os_name = "Linux"
        metadata = root.find("metadata")
        if metadata is not None:
            for child in metadata.iter():
                if "libosinfo" in child.tag and "id" in child.attrib:
                    os_id = child.attrib["id"]
                    # e.g. http://debian.org/debian/13 -> Debian 13
                    parts = os_id.strip("/").split("/")
                    if len(parts) >= 2:
                        os_name = f"{parts[-2].capitalize()} {parts[-1]}"
                    else:
                        os_name = parts[-1].capitalize()
                    break

        # Disks
        disks = []
        total_disk_bytes = 0
        allocated_disk_bytes = 0
        primary_disk_bus = "virtio"

        devices = root.find("devices")
        if devices is not None:
            for disk_elem in devices.findall("disk"):
                device_type = disk_elem.get("device", "disk")
                if device_type not in ("disk", "lun"):
                    continue

                driver = disk_elem.find("driver")
                disk_format = driver.get("type", "qcow2") if driver is not None else "qcow2"

                target = disk_elem.find("target")
                dev_name = target.get("dev", "vda") if target is not None else "vda"
                bus = target.get("bus", "virtio") if target is not None else "virtio"
                primary_disk_bus = bus

                source = disk_elem.find("source")
                file_path = ""
                if source is not None:
                    file_path = source.get("file", source.get("dev", ""))

                if not file_path:
                    continue

                # Query storage capacity & allocation using virsh vol-dumpxml / vol-info if possible
                capacity_bytes, alloc_bytes, backing_file = self._query_volume_details(file_path)
                total_disk_bytes += capacity_bytes
                allocated_disk_bytes += alloc_bytes

                disks.append({
                    "device": dev_name,
                    "bus": bus,
                    "path": file_path,
                    "format": disk_format,
                    "capacity_bytes": capacity_bytes,
                    "allocation_bytes": alloc_bytes,
                    "capacity_gb": round(capacity_bytes / (1024**3), 2),
                    "allocation_gb": round(alloc_bytes / (1024**3), 2),
                    "backing_file": backing_file,
                })

        # Interfaces
        interfaces = []
        if devices is not None:
            for iface_elem in devices.findall("interface"):
                iface_type = iface_elem.get("type", "network")
                mac_elem = iface_elem.find("mac")
                mac_addr = mac_elem.get("address", "") if mac_elem is not None else ""

                model_elem = iface_elem.find("model")
                model_type = model_elem.get("type", "virtio") if model_elem is not None else "virtio"

                source_elem = iface_elem.find("source")
                src_net = ""
                if source_elem is not None:
                    src_net = source_elem.get("network", source_elem.get("bridge", ""))

                interfaces.append({
                    "mac": mac_addr,
                    "type": iface_type,
                    "model": model_type,
                    "source_network": src_net,
                    "ip_addresses": [],
                })

        return {
            "name": name,
            "uuid": uuid_str,
            "state": state,
            "vcpu": vcpu,
            "memory_kb": memory_kb,
            "os_name": os_name,
            "firmware_type": firmware_type,
            "disk_bus": primary_disk_bus,
            "total_disk_bytes": total_disk_bytes,
            "allocated_disk_bytes": allocated_disk_bytes,
            "disks": disks,
            "interfaces": interfaces,
            "xml_desc": xml_out,
        }

    def _query_volume_details(self, path: str) -> Tuple[int, int, str | None]:
        """Queries volume capacity, allocation and backing file."""
        capacity = 0
        allocated = 0
        backing = None
        vol_name = path.split("/")[-1]

        # 1. Try virsh vol-dumpxml <volname> default
        code, xml_out, _ = self.ssh.execute(f"virsh vol-dumpxml '{vol_name}' default")
        if code == 0:
            try:
                root = ET.fromstring(xml_out)
                cap_elem = root.find("capacity")
                if cap_elem is not None and cap_elem.text:
                    capacity = int(cap_elem.text.strip())
                alloc_elem = root.find("allocation")
                if alloc_elem is not None and alloc_elem.text:
                    allocated = int(alloc_elem.text.strip())
                backing_elem = root.find("backingStore/path")
                if backing_elem is not None and backing_elem.text:
                    backing = backing_elem.text.strip()
                return capacity, allocated, backing
            except Exception:
                pass

        # 2. Try qemu-img info if permitted
        code, img_out, _ = self.ssh.execute(f"qemu-img info --output=json '{path}'")
        if code == 0:
            import json
            try:
                data = json.loads(img_out)
                capacity = data.get("virtual-size", 0)
                allocated = data.get("actual-size", 0)
                backing = data.get("backing-filename")
                return capacity, allocated, backing
            except Exception:
                pass

        # Fallback default estimate if read permission restricted
        return 53687091200, 10737418240, None
